const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");
const Joi = require("joi");
const Clinc = require("../models/Clinc");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Step 1: Personal Info
const personalSchema = Joi.object({
  image: Joi.object({
    publicId: Joi.string(),
    url: Joi.string().uri(),
  }).optional(),
  firstName: Joi.string().min(1).required(),
  lastName: Joi.string().min(1).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).required(),
  password: Joi.string().min(6).required(),
  gender: Joi.string().valid("Male", "Female").required(),
  role: Joi.string().valid("admin", "client", "provider").required(),

  dateOfBirth: Joi.object({
    day: Joi.number().min(1).max(31).required(),
    month: Joi.string().min(2).required(),
    year: Joi.number().min(1900).max(new Date().getFullYear()).required(),
  }).required(),

  postalCode: Joi.string().min(1).required(),
});

// Step 2–4: Extra info for providers
const providerSchema = personalSchema.keys({
  isVerified: Joi.boolean().default(false),

  specialty: Joi.string().required(),
  subspecialty: Joi.string().required(),
  experienceYears: Joi.number().integer().min(0).required(),
  licenseNumber: Joi.string().min(3).required(),
  licenseFile: Joi.any().required(),

  clinicName: Joi.string().min(2).required(),
  ClinicLocation: Joi.object({
    city: Joi.string().min(1).required(),
    district: Joi.string().min(1).required(),
    postalCode: Joi.string().min(1).required(),
  }).required(),
  timeFrom: Joi.string()
    .pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .required(),
  timeTo: Joi.string()
    .pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .required(),
  day: Joi.string()
    .valid(
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    )
    .required(),
  clinicPhoto: Joi.any().required(),

  availability: Joi.object()
    .pattern(
      Joi.string().valid(
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ),
      Joi.object({
        from: Joi.string()
          .pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
          .required(),
        to: Joi.string()
          .pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
          .required(),
      })
    )
    .required(),
});

const passwordValidationSchema = Joi.object({
  oldPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(6).required().invalid(Joi.ref("oldPassword")),
  confirmPassword: Joi.valid(Joi.ref("newPassword"))
    .messages({ "any.only": "Passwords do not match" })
    .required(),
});

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      image:user?.image?.url,
      name: user.firstName,
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "5h" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

const registerUser = async (req, res) => {
  console.log("Registering user:", req.body);

  const { role } = req.body;

  const schema = role === "provider" ? providerSchema : personalSchema;

  const { error } = schema.validate(req.body);

  if (error) {
    console.log("validation erorr", error);
    return res.status(400).json({ error: "Something went wrong" });
  }

  try {
    const {
      password,
      clinicName,
      ClinicLocation,
      timeFrom,
      timeTo,
      day,
      clinicPhoto,
    } = req.body;

    // ✅ Check if email exists
    const existing = await User.findOne({ email: req.body.email });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    req.body.password = hashedPassword;

    // ✅ Create user
    const user = new User(req.body);
    await user.save();

    // ✅ If role is provider, create clinic entry
    if (user.role === "provider" && clinicName && ClinicLocation) {
      const newClinic = new Clinc({
        name: clinicName,
        postalCode: ClinicLocation.postalCode, // must exist in PostalCodeSchema if you reference it
        timeFrom,
        timeTo,
        day: [day], // because schema expects an array
        clinicPhoto: clinicPhoto || {},
      });

      const savedClinic = await newClinic.save();

      // ✅ Link clinic to user
      user.clinics.push(savedClinic._id);
      await user.save();
    }

    if (user.role === "provider") {
      return res.status(201).json({
        message: "Registration successful. Pending admin approval.",
      });
    }

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

const loginUser = async (req, res) => {
  console.log("hiii");
  console.log("data", req.body);

  try {
    const user = await User.findOne({ email: req.body.email })
      .populate({
        path: "subspecialty",
        populate: { path: "specialty" },
      })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: {
            path: "city", // <-- 3rd level nested
          },
        },
      });

    console.log("Logging in user:", req.body);
    console.log("Found user:", user);

    if (!user || !(await bcrypt.compare(req.body?.password, user?.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.role === "provider" && !user.isVerified) {
      return res
        .status(403)
        .json({ error: "Account not approved by admin yet" });
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // ✅ Set cookies before sending JSON
    res.cookie("session", token, {
      httpOnly: false, // admin gets httpOnly true
      secure: true, // true in production
      sameSite: "none" ,
      maxAge: 5 * 60 * 60 * 1000, // 5 hours
 
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 da
    
    });

    // ✅ Send single JSON response and stop execution
    return res.status(200).json({
      accessToken: token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        gender:user.gender,
        dateOfBirth:user.dateOfBirth,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        image: user.image,
        subspecialty: user.subspecialty,
        city:user.postalCode.district.city.name,
        district:user.postalCode.district.name,
        postalCode:user.postalCode.code,
        availability:user.availability,
        isAvailable:user.isAvailable
      },
    });
  } catch (err) {
    console.error("Error logging in user:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

const logoutUser = (req, res) => {
  console.log("logigng outtt");
  try {
    // 🧹 امسح الكوكيز اللي فيها التوكنات
    res.clearCookie("session", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // 🔁 رجّع رد بسيط للفرونت
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Server error during logout" });
  }
};

const ChangePassword = async (req, res) => {
  try {
    const id = req.user.id;

    const { error, value } = passwordValidationSchema.validate(req.body, {
      abortEarly: false, // show all errors at once (optional)
    });

    if (error) {
      return res
        .status(400)
        .json({ error: error.details.map((d) => d.message) });
    }

    const { oldPassword, newPassword } = value;

    const user = await User.findById(id).select("+password");

    if (!user) {
      res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Old password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10); // 12 salt rounds is a good balance
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change‑password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const refreshAccessToken = (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const newAccessToken = generateAccessToken(decoded);
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(403).json({ error: "Invalid refresh token" });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // not allow registration via google
      return res.status(400).json({ error: "No account associated with this Google email" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("session", accessToken, {
      httpOnly: user.role === "admin",
      secure: false,
      sameSite: "lax",
      maxAge: 5 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        role: user.role,
      },
      accessToken,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(400).json({ error: "Invalid Google token" });
  }
};



module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  ChangePassword,
  refreshAccessToken,
  googleLogin
};
