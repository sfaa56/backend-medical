const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");
const joi = require("joi");

const userValidationSchema = joi.object({
  name: joi.string().min(3).required(),
  email: joi.string().email().required(),
  password: joi.string().min(6).required(),
  phoneNumber: joi.string().required(),
  city: joi.string().optional(),
  region: joi.string().optional(),
  role: joi.string().valid("admin", "client","provider").optional(),
  isVerified:joi.boolean().optional(),
  SubSpecialty:joi.string().optional(),
  image: joi.object({
    publicId: joi.string().optional(),
    url: joi.string().optional(),
  }).optional(),
  postalCode: joi.string().optional(),
});

const passwordValidationSchema = joi.object({
  oldPassword: joi.string().min(6).required(),
  newPassword: joi.string().min(6).required().invalid(joi.ref("oldPassword")),
  confirmPassword: joi
    .valid(joi.ref("newPassword"))
    .messages({ "any.only": "Passwords do not match" }).required(),
});

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "5h" }
  );
};

const registerUser = async (req, res) => {
  console.log("Registering user:", req.body);

  const { error } = userValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  try {
    const { email, password, phoneNumber } = req.body;

    if (!email || !password || !phoneNumber) {
      return res.status(400).json({ error: "Please fill all fields" });
    }

    const existing = await User.findOne({ email: req.body.email });
    if (existing)
      return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    req.body.password = hashedPassword;

    const user = new User(req.body);
    await user.save();

    if (user.role === "provider") {
      return res.status(201).json({
        message: "Provider registered. Awaiting admin approval.",
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved,
        },
      });
    }

    res.status(201).json({ user });
  } catch (err) {
    console.log("Error registering user:", err);
    res.status(500).json({ error: err.message });
  }
};

const loginUser = async (req, res) => {
  console.log("hiii");
  try {
    const user = await User.findOne({ email: req.body.email });

    console.log("Logging in user:", req.body);
    console.log("Found user:", user);

    if (!user || !(await bcrypt.compare(req.body?.password, user?.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.role === "provider" && !user.isApproved)
      return res
        .status(403)
        .json({ error: "Account not approved by admin yet" });

    const token = generateAccessToken(user);

    // ✅ Set JWT in a cookie
    res.cookie("session", token, {
      httpOnly: true, // prevents access from JavaScript
      secure:true, // HTTPS only in production
      // protects against CSRF
            sameSite: "none", // protects against CSRF
      maxAge: 5 * 60 * 60 * 1000, // 5 hours

    });

    res.status(200).json({ user });
  } catch (err) {
    console.log("Error logging in user:", err);
    res.status(500).json({ error: "something went wrong" });
  }
};

const logoutUser = (req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.status(200).json({ message: "Logged out successfully" });
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

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  ChangePassword,
};
