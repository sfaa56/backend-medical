const Booking = require("../models/Booking");
const Offer = require("../models/Offer");
const Review = require("../models/Review");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const joi = require("joi");
const Clinc = require("../models/Clinc");
const { default: mongoose } = require("mongoose");
const ProviderService = require("../models/ProviderService");
const Appointment = require("../models/Appointment");

const userValidationSchema = joi.object({
  _id: joi.string().optional(),
  id: joi.string().optional(),
  name: joi.string().min(3).required(),
  email: joi.string().email().required(),
  password: joi.string().min(6).required(),
  phoneNumber: joi.string().required(),
  city: joi.string().optional(),
  region: joi.string().optional(),
  role: joi.string().valid("admin", "user", "provider").optional(),
  avatar: joi.string().optional(),
});

const SubSpecialty = require("../models/Sub-specialties");
const Specialty = require("../models/Speicalty");

const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    console.log("req.query", req.query);

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const skip = (page - 1) * limit;

    // Build base filter (exclude admins)
    const filter = { role: { $ne: "admin" } };

    // --- Text search (name / email / phone) ---
    if (req.query.search) {
      const q = String(req.query.search).trim();
      const re = new RegExp(q, "i");
      filter.$or = [
        { firstName: re },
        { lastName: re },
        { email: re },
        { phone: re },
      ];
    }

    // --- Role (client/provider) ---
    if (req.query.role) {
      const role = String(req.query.role).toLowerCase();
      if (["client", "provider"].includes(role)) filter.role = role;
    }

    // --- Status (isActive true/false) ---
    if (req.query.status) {
      const status = String(req.query.status).toLowerCase();
      if (status === "active") filter.isActive = true;
      else if (status === "inactive") filter.isActive = false;
    }

    // --- isVerified filter (true / false) ---
    if (req.query.isVerified !== undefined) {
      console.log("hiiiii");
      const v = String(req.query.isVerified).toLowerCase();
      if (v === "true") filter.isVerified = true;
      else if (v === "false") filter.isVerified = false;
    }

    // --- Specialty / SubSpecialty filtering ---
    // Accepts: specialty (id or name), subspecialty (id or name), or comma-separated lists
    // We'll resolve to an array of SubSpecialty _id values and filter users.subspecialty: { $in: [...] }
    let subspecialtyIdsToFilter = null;

    // Helper: parse comma separated param into array of trimmed strings
    const parseList = (val) =>
      String(val || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    // If user passed a specialty (could be id or name)
    if (req.query.specialty) {
      const specialties = parseList(req.query.specialty);

      // For each provided specialty term, try to find specialty docs by _id or name
      const specialtyQueryOr = specialties.map((s) =>
        mongoose.Types.ObjectId.isValid(s)
          ? { _id: s }
          : { name: new RegExp(s, "i") }
      );

      // find matching specialties
      const foundSpecialties = await Specialty.find({
        $or: specialtyQueryOr,
      }).select("_id");
      const specialtyIds = foundSpecialties.map((d) => d._id);

      if (specialtyIds.length) {
        // find subspecialties that belong to these specialties
        const subs = await SubSpecialty.find({
          specialty: { $in: specialtyIds },
        }).select("_id");
        subspecialtyIdsToFilter = subs.map((s) => s._id);
      } else {
        // No specialties matched -> no users will match
        return res.status(200).json({
          success: true,
          data: [],
          meta: { total: 0, totalPages: 0, page, limit, count: 0 },
        });
      }
    }

    // If user passed subspecialty directly (id or name)
    if (req.query.subspecialty) {
      const subsInput = parseList(req.query.subspecialty);
      // find SubSpecialty by id or name
      const subsQueryOr = subsInput.map((s) =>
        mongoose.Types.ObjectId.isValid(s)
          ? { _id: s }
          : { name: new RegExp(s, "i") }
      );

      const foundSubs = await SubSpecialty.find({ $or: subsQueryOr }).select(
        "_id"
      );
      const foundSubIds = foundSubs.map((s) => s._id);

      if (foundSubIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          meta: { total: 0, totalPages: 0, page, limit, count: 0 },
        });
      }

      // If specialty filter already set, intersect; otherwise use these
      if (subspecialtyIdsToFilter) {
        subspecialtyIdsToFilter = subspecialtyIdsToFilter.filter((id) =>
          foundSubIds.some((f) => f.equals(id))
        );
        if (subspecialtyIdsToFilter.length === 0) {
          return res.status(200).json({
            success: true,
            data: [],
            meta: { total: 0, totalPages: 0, page, limit, count: 0 },
          });
        }
      } else {
        subspecialtyIdsToFilter = foundSubIds;
      }
    }

    // If we have resolved subspecialty ids, add to filter
    if (
      Array.isArray(subspecialtyIdsToFilter) &&
      subspecialtyIdsToFilter.length
    ) {
      filter.subspecialty = { $in: subspecialtyIdsToFilter };
    }

    // --- Sorting ---
    let sort = { createdAt: -1 };
    const sortParam = String(req.query.sort || "").toLowerCase();
    if (sortParam === "rating") sort = { averageRating: -1 };
    else if (sortParam === "experience") sort = { experienceYears: -1 };
    else if (sortParam === "newest") sort = { createdAt: -1 };

    // --- Execute query + count in parallel ---
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate("subspecialty") // if you need subspecialty docs
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil((total || 0) / limit);

    return res.status(200).json({
      success: true,
      data: users,
      meta: {
        total,
        totalPages,
        page,
        limit,
        count: users.length,
      },
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const parseIds = (val) => {
  if (!val) return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const getAllProviders = async (req, res) => {
  try {
    // Initialize pipeline
    const pipeline = [];

    // Base match for providers only
    pipeline.push({ $match: { role: "provider" } });

    // Lookup for subspecialties
    pipeline.push({
      $lookup: {
        from: "subspecialties",
        localField: "subspecialty",
        foreignField: "_id",
        as: "subspecialties",
      },
    });

    // Lookup for specialties
    pipeline.push({
      $lookup: {
        from: "specialties",
        let: { subspecialties: "$subspecialties" },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: [
                  "$_id",
                  {
                    $map: {
                      input: "$$subspecialties",
                      as: "sub",
                      in: "$$sub.specialty",
                    },
                  },
                ],
              },
            },
          },
        ],
        as: "specialties",
      },
    });

    // Lookup for provider services with nested lookups for serviceCategory and subServiceCategory
    pipeline.push({
      $lookup: {
        from: "providerservices", // Ensure this matches your actual collection name
        localField: "_id",
        foreignField: "providerId",
        as: "providerServices",
      },
    });

    // Populate serviceCategory and subServiceCategory in providerServices
    pipeline.push({
      $unwind: {
        path: "$providerServices",
        preserveNullAndEmptyArrays: true,
      },
    });

    pipeline.push({
      $lookup: {
        from: "servicecategories", // Ensure this matches your actual collection name
        localField: "providerServices.serviceCategory",
        foreignField: "_id",
        as: "providerServices.serviceCategory",
      },
    });

    pipeline.push({
      $lookup: {
        from: "subservicecategories", // Ensure this matches your actual collection name
        localField: "providerServices.subServiceCategory",
        foreignField: "_id",
        as: "providerServices.subServiceCategory",
      },
    });

    // Lookup for qualifications
    pipeline.push({
      $lookup: {
        from: "qualifications", // Ensure this matches your actual collection name
        localField: "_id",
        foreignField: "user",
        as: "qualifications",
      },
    });

    // Apply filters
    const matchFilters = {};

    // Specialty filter
    const specialties = parseIds(req.query.specialty);
    if (specialties.length > 0) {
      matchFilters["specialties._id"] = {
        $in: specialties.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    // Subspecialty filter
    const subspecialties = parseIds(req.query.subspecialty);
    if (subspecialties.length > 0) {
      matchFilters["subspecialties._id"] = {
        $in: subspecialties.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    // Text search
    if (req.query.title) {
      matchFilters.$or = [
        { firstName: { $regex: req.query.title, $options: "i" } },
        { lastName: { $regex: req.query.title, $options: "i" } },
        { about: { $regex: req.query.title, $options: "i" } },
      ];
    }

    // Other filters
    if (req.query.gender) matchFilters.gender = req.query.gender;
    if (req.query.isAvailable === "true") matchFilters.isAvailable = true;
    if (req.query.experienceYears) {
      matchFilters.experienceYears = {
        $gte: parseInt(req.query.experienceYears),
      };
    }
    if (req.query.rating) {
      matchFilters.averageRating = { $gte: parseFloat(req.query.rating) };
    }

    // Apply all filters
    if (Object.keys(matchFilters).length > 0) {
      pipeline.push({ $match: matchFilters });
    }

    // Lookup location info
    pipeline.push(
      {
        $lookup: {
          from: "postalcodes",
          localField: "postalCode",
          foreignField: "_id",
          as: "postalCode",
        },
      },
      { $unwind: { path: "$postalCode", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "districts",
          localField: "postalCode.district",
          foreignField: "_id",
          as: "district",
        },
      },
      { $unwind: { path: "$district", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "cities",
          localField: "district.city",
          foreignField: "_id",
          as: "city",
        },
      },
      { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } }
    );

    // Location filter
    if (req.query.location) {
      const placeRegex = { $regex: req.query.location, $options: "i" };
      pipeline.push({
        $match: {
          $or: [
            { "city.name": placeRegex },
            { "district.name": placeRegex },
            { "postalCode.code": placeRegex },
          ],
        },
      });
    }

    pipeline.push({
      $group: {
        _id: "$_id",
        doc: { $first: "$$ROOT" },
        providerServices: { $addToSet: "$providerServices" }, // combine services back
      },
    });

    pipeline.push({
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ["$doc", { providerServices: "$providerServices" }],
        },
      },
    });

    // Project final shape
    pipeline.push({
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        image: 1,
        gender: 1,
        role: 1,
        experienceYears: 1,
        averageRating: 1,
        totalReviews: 1,
        isAvailable: 1,
        about: 1,
        availability: 1,
        location: 1,
        specialties: {
          $map: {
            input: "$specialties",
            as: "spec",
            in: {
              _id: "$$spec._id",
              name: "$$spec.name",
            },
          },
        },
        subspecialties: {
          $map: {
            input: "$subspecialties",
            as: "sub",
            in: {
              _id: "$$sub._id",
              name: "$$sub.name",
              specialty: "$$sub.specialty",
            },
          },
        },
        providerServices: {
          place: "$providerServices.place",
          serviceCategory: {
            $arrayElemAt: ["$providerServices.serviceCategory", 0],
          },
          subServiceCategory: {
            $arrayElemAt: ["$providerServices.subServiceCategory", 0],
          },
        },
        qualifications: {
          $map: {
            input: "$qualifications",
            as: "qual",
            in: {
              title: "$$qual.title",
              institution: "$$qual.institution",
            },
          },
        },
        locationn: {
          postalCode: "$postalCode.code",
          district: "$district.name",
          city: "$city.name",
          fullAddress: {
            $concat: [
              { $ifNull: ["$city.name", ""] },
              ", ",
              { $ifNull: ["$district.name", ""] },
              " ",
              { $ifNull: ["$postalCode.code", ""] },
            ],
          },
        },
      },
    });

    // Sorting
    const sortOptions = {
      rating: { averageRating: -1 },
      experience: { experienceYears: -1 },
      newest: { createdAt: -1 },
    };
    const sort = sortOptions[req.query.sort] || { createdAt: -1 };
    pipeline.push({ $sort: sort });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Execute query
    const providers = await User.aggregate(pipeline);
    const totalProviders = await User.countDocuments({ role: "provider" });

    res.status(200).json({
      success: true,
      meta: {
        page,
        limit,
        total: totalProviders,
        totalPages: Math.ceil(totalProviders / limit),
      },
      data: providers,
    });
  } catch (err) {
    console.error("Error in getAllProviders:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const ServiceRequest = require("../models/ServiceRequest");

const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    // ------------------- Fetch user -------------------
    const user = await User.findById(id)
      .select("-password")
      .populate({
        path: "subspecialty",
        populate: { path: "specialty" },
      })
      .populate({
        path: "clinics",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: { path: "city" },
          },
        },
      })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      })
      .populate("experiences")
      .populate("qualifications")
      .populate({
        path: "services",
        populate: [
          { path: "serviceCategory" },
          { path: "subServiceCategory" },
          { path: "specialty" },
        ],
      });

    console.log("user", user);

    if (!user) return res.status(404).json({ error: "User not found" });

    // ------------------- Fetch Service Requests if client -------------------
    let serviceRequests = [];
    if (user.role === "client") {
      serviceRequests = await ServiceRequest.find({ clientId: id })
        .populate({
          path: "subSpecialty",
          populate: { path: "specialty" },
        })
        .populate("postalCode")
        .populate("subCategory")
        .populate({
          path: "acceptedProvider",
          select: "firstName lastName email phone",
        })
        .sort({ createdAt: -1 });
    }

    // ------------------- Group subspecialties by specialty -------------------
    const groupedSubspecialties = {};
    if (user.subspecialty?.length) {
      user.subspecialty.forEach((sub) => {
        const spec = sub.specialty;
        if (!groupedSubspecialties[spec._id]) {
          groupedSubspecialties[spec._id] = {
            specialtyId: spec._id,
            specialtyName: spec.name,
            subSpecialties: [],
          };
        }
        groupedSubspecialties[spec._id].subSpecialties.push({
          value: sub._id,
          label: sub.name,
        });
      });
    }

    // Convert grouped object → array
    const formattedSubspecialties = Object.values(groupedSubspecialties);

    // ------------------- Add hasService flag -------------------
    const specialtiesWithServices = new Set(
      user.services
        ?.map((srv) => srv.specialty?._id?.toString())
        .filter(Boolean)
    );

    const formattedWithFlags = formattedSubspecialties.map((fs) => ({
      ...fs,
      hasService: specialtiesWithServices.has(fs.specialtyId.toString()),
    }));

    // ------------------- Response -------------------
    res.status(200).json({
      ...user.toObject(),
      availability: user.availability,
      serviceRequests,
      formattedSubspecialties: formattedWithFlags, // 👈 Add formatted structure here
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getUserById };

const getProviderById = async (req, res) => {
  const { id } = req.params;
  console.log("id", id);
  try {
    const provider = await User.findOne({ _id: id, role: "provider" })
      .select("-password")
      .populate({
        path: "subspecialty",
        populate: { path: "specialty" },
      })
      .populate({
        path: "clinics",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: { path: "city" },
          },
        },
      })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      })
      .populate("experiences")
      .populate("qualifications");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Get provider services
    const services = await ProviderService.find({ providerId: id })
      .populate("serviceCategory", "name")
      .populate("subServiceCategory", "name")
      .populate("specialty", "name")
      .lean();

    // Get provider reviews
    const reviews = await Review.find({ providerId: id })
      .populate("clientId", "firstName lastName image")
      .populate("appointmentId", "date")
      .sort({ createdAt: -1 })
      .lean();

    console.log("provider", provider?.availability);

    // Calculate ratings
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Combine all data
    const providerData = provider.toObject();

    console.log("providerData", providerData?.availability);

    providerData.services = services;
    providerData.reviews = reviews;
    providerData.statistics = {
      averageRating,
      totalReviews: reviews.length,
      totalServices: services.length,
    };

    res.status(200).json({
      success: true,
      data: providerData,
      availability: provider?.availability,
    });
  } catch (err) {
    console.error("Error in getProviderById:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const updatePicFromAdmin = async (req, res) => {
  console.log("req.body", req.body);

  if (req.user.role !== "admin") {
    return res.status(400).json({ success: false, error: "Not authorized" });
  }

  const { imageUrl, publicId, id } = req.body;

  const userId = id;

  try {
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    if (user && user.image && user.image.publicId) {
      await cloudinary.uploader.destroy(user.image.publicId);
    }

    user.image.publicId = publicId;
    user.image.url = imageUrl;
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ success: false, error: "Update failed" });
  }
};

const userPicture = async (req, res) => {
  console.log("req.body", req.body);
  const { imageUrl, publicId, id } = req.body;

  const userId = req.user.id || id;

  try {
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    if (user && user.image && user.image.publicId) {
      await cloudinary.uploader.destroy(user.image.publicId);
    }

    user.image.publicId = publicId;
    user.image.url = imageUrl;
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ success: false, error: "Update failed" });
  }
};

const updateUser = async (req, res) => {
  const userId = req.params.id;
  const currentUser = req.user;

  console.log("currentUser", currentUser);
  console.log("Updating user ID:", userId);

  // ✅ Only admin or the same user can update
  if (currentUser.role !== "admin" && currentUser.id !== userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const userToUpdate = await User.findById(userId).select("-password");

    if (!userToUpdate) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Check email uniqueness
    if (req.body.email && req.body.email !== userToUpdate.email) {
      const existingEmail = await User.findOne({ email: req.body.email });
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    const postalCodeObj = await PostalCode.findOne(
      req.body.location.postalcode
    );

    if (!postalCodeObj) {
      return res
        .status(404)
        .json({ success: false, message: "Something went wrong" });
    }

    if (req.body.location) {
      console.log("req.body.loaction", req.body.location);
      console.log("postalCodeObj.code", postalCodeObj.code);
      const { city, district, postalCode } = req.body.location;

      const coords = await geocodeAddress(city, district, postalCodeObj.code);
      console.log("cards", coords);
      req.body.postalCode = postalCode;
      req.body.location = coords
        ? { type: "Point", coordinates: [coords.lon, coords.lat] }
        : undefined;

      // Remove the original location object from body
      delete req.body.location;
    }

    // ✅ Merge updates
    Object.assign(userToUpdate, req.body);

    // ✅ Save changes
    const updatedUser = await userToUpdate.save();

    // ✅ Populate clinics for response
    await updatedUser.populate([
      {
        path: "subspecialty",
        populate: { path: "specialty" },
      },
      {
        path: "experiences",
      },
      {
        path: "qualifications",
      },
      {
        path: "clinics",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: { path: "city" },
          },
        },
      },
      {
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      },
    ]);

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

const deleteUser = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete user's profile image
    if (user.image && user.image.publicId) {
      await cloudinary.uploader.destroy(user.image.publicId);
    }

    if(user.role==="client"){
      await ServiceRequest.deleteMany({clientId:user._id});
    }

    // Delete provider services and their images
    const services = await ProviderService.find({ providerId: userId });
    for (const service of services) {
      if (service.image && service.image.publicId) {
        await cloudinary.uploader.destroy(service.image.publicId);
      }
    }
    await ProviderService.deleteMany({ providerId: userId });

    // Delete appointments where user is provider or client
    await Appointment.deleteMany({
      $or: [{ providerId: userId }, { clientId: userId }],
    });

    // Delete related documents
    await Promise.all([
      Offer.deleteMany({ providerId: userId }),
      Review.deleteMany({
        $or: [{ providerId: userId }, { clientId: userId }],
      }),
      ServiceBookingRequest.deleteMany({
        $or: [{ providerId: userId }, { clientId: userId }],
      }),
    ]);

    // Delete the user
    await User.findByIdAndDelete(userId);

    res
      .status(200)
      .json({ message: "User and all related data deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const toggleAvailability = async (req, res) => {
  try {
    // ensure only providers can toggle
    if (req.user.role !== "provider") {
      return res
        .status(403)
        .json({ message: "Only providers can update availability" });
    }

    const provider = await User.findById(req.user.id);
    if (!provider)
      return res.status(404).json({ message: "Provider not found" });

    provider.isAvailable = !provider.isAvailable;
    await provider.save();

    res.status(200).json({
      success: true,
      message: `Availability updated to ${
        provider.isAvailable ? "available" : "unavailable"
      }`,
      data: { isAvailable: provider.isAvailable },
    });
  } catch (err) {
    console.error("toggleAvailability error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

const ServiceBookingRequest = require("../models/BookingRequest");
const { success } = require("zod");
const PostalCode = require("../models/PostalCode");
const { geocodeAddress } = require("../utils/geocode");

// ✅ KPI summary for provider dashboard
const getProviderKPI = async (req, res) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);

    // 🔹 1. Count unique patients
    const appointments = await Appointment.find({ providerId })
      .select("clientId")
      .lean();

    const uniquePatients = new Set(
      appointments.map((a) => a.clientId?.toString()).filter(Boolean)
    ).size;

    // 🔹 2. Count pending booking requests
    const pendingBookingsCount = await ServiceBookingRequest.countDocuments({
      providerId,
      status: "pending",
    });

    // 🔹 3. Count completed appointments
    const completedAppointmentsCount = await Appointment.countDocuments({
      providerId,
      status: "completed",
    });

    // ✅ Response
    res.status(200).json({
      success: true,
      data: {
        totalPatients: uniquePatients,
        pendingBookings: pendingBookingsCount,
        completedAppointments: completedAppointmentsCount,
      },
    });
  } catch (err) {
    console.error("Error fetching provider KPI:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching provider KPI data",
      error: err.message,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  userPicture,
  toggleAvailability,
  getAllProviders,
  getProviderById,
  getProviderKPI,
  updatePicFromAdmin,
};
