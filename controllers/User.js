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

const getAllUsers = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const users = await User.find({ role: { $ne: "admin" } })
      .populate("subspecialty")
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log("users", users);

    const totalUsers = await User.countDocuments();

    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json(users, totalUsers, totalPages, page);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "something went wrong" });
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
        as: "subspecialties"
      }
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
                $in: ["$_id", {
                  $map: {
                    input: "$$subspecialties",
                    as: "sub",
                    in: "$$sub.specialty"
                  }
                }]
              }
            }
          }
        ],
        as: "specialties"
      }
    });

    // Lookup for provider services with nested lookups for serviceCategory and subServiceCategory
    pipeline.push({
      $lookup: {
        from: "providerservices", // Ensure this matches your actual collection name
        localField: "_id",
        foreignField: "providerId",
        as: "providerServices"
      }
    });

    // Populate serviceCategory and subServiceCategory in providerServices
    pipeline.push({
      $unwind: {
        path: "$providerServices",
        preserveNullAndEmptyArrays: true
      }
    });

    pipeline.push({
      $lookup: {
        from: "servicecategories", // Ensure this matches your actual collection name
        localField: "providerServices.serviceCategory",
        foreignField: "_id",
        as: "providerServices.serviceCategory"
      }
    });

    pipeline.push({
      $lookup: {
        from: "subservicecategories", // Ensure this matches your actual collection name
        localField: "providerServices.subServiceCategory",
        foreignField: "_id",
        as: "providerServices.subServiceCategory"
      }
    });

    // Lookup for qualifications
    pipeline.push({
      $lookup: {
        from: "qualifications", // Ensure this matches your actual collection name
        localField: "_id",
        foreignField: "user",
        as: "qualifications"
      }
    });

    // Apply filters
    const matchFilters = {};

    // Specialty filter
    const specialties = parseIds(req.query.specialty);
    if (specialties.length > 0) {
      matchFilters["specialties._id"] = {
        $in: specialties.map(id => new mongoose.Types.ObjectId(id))
      };
    }

    // Subspecialty filter
    const subspecialties = parseIds(req.query.subspecialty);
    if (subspecialties.length > 0) {
      matchFilters["subspecialties._id"] = {
        $in: subspecialties.map(id => new mongoose.Types.ObjectId(id))
      };
    }

    // Text search
    if (req.query.title) {
      matchFilters.$or = [
        { firstName: { $regex: req.query.title, $options: "i" } },
        { lastName: { $regex: req.query.title, $options: "i" } },
        { about: { $regex: req.query.title, $options: "i" } }
      ];
    }

    // Other filters
    if (req.query.gender) matchFilters.gender = req.query.gender;
    if (req.query.isAvailable === "true") matchFilters.isAvailable = true;
    if (req.query.experienceYears) {
      matchFilters.experienceYears = { $gte: parseInt(req.query.experienceYears) };
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
          as: "postalCode"
        }
      },
      { $unwind: { path: "$postalCode", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "districts",
          localField: "postalCode.district",
          foreignField: "_id",
          as: "district"
        }
      },
      { $unwind: { path: "$district", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "cities",
          localField: "district.city",
          foreignField: "_id",
          as: "city"
        }
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
            { "postalCode.code": placeRegex }
          ]
        }
      });
    }

pipeline.push({
  $group: {
    _id: "$_id",
    doc: { $first: "$$ROOT" },
    providerServices: { $addToSet: "$providerServices" } // combine services back
  }
});

pipeline.push({
  $replaceRoot: {
    newRoot: {
      $mergeObjects: ["$doc", { providerServices: "$providerServices" }]
    }
  }
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
        specialties: {
          $map: {
            input: "$specialties",
            as: "spec",
            in: {
              _id: "$$spec._id",
              name: "$$spec.name"
            }
          }
        },
        subspecialties: {
          $map: {
            input: "$subspecialties",
            as: "sub",
            in: {
              _id: "$$sub._id",
              name: "$$sub.name",
              specialty: "$$sub.specialty"
            }
          }
        },
        providerServices: {
          place: "$providerServices.place",
          serviceCategory: {
            $arrayElemAt: ["$providerServices.serviceCategory", 0]
          },
          subServiceCategory: {
            $arrayElemAt: ["$providerServices.subServiceCategory", 0]
          }
        },
        qualifications: {
          $map: {
            input: "$qualifications",
            as: "qual",
            in: {
              title: "$$qual.title",
              institution: "$$qual.institution"
            }
          }
        },
        location: {
          postalCode: "$postalCode.code",
          district: "$district.name",
          city: "$city.name",
          fullAddress: {
            $concat: [
              { $ifNull: ["$city.name", ""] },
              ", ",
              { $ifNull: ["$district.name", ""] },
              " ",
              { $ifNull: ["$postalCode.code", ""] }
            ]
          }
        }
      }
    });

    // Sorting
    const sortOptions = {
      rating: { averageRating: -1 },
      experience: { experienceYears: -1 },
      newest: { createdAt: -1 }
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
        totalPages: Math.ceil(totalProviders / limit)
      },
      data: providers
    });

  } catch (err) {
    console.error("Error in getAllProviders:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};



const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id)
      .select("-password")
      .populate({
        path: "subspecialty",
        populate: { path: "specialty" }, // ✅ small "s"
      })
      .populate({
        path: "clinics",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: {
              path: "city", // <-- 3rd level nested
            },
          },
        },
      })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: {
            path: "city", // <-- 3rd level nested
          },
        },
      })
      .populate("experiences")
      .populate("qualifications")
      .populate({
        path: "services",
        populate: [
          {
            path: "serviceCategory",
          },
          {
            path: "subServiceCategory",
          },
          {
            path: "specialty",
          },
        ],
      });

    console.log(user);

    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};


const getProviderById = async (req, res) => {
  const { id } = req.params;
  console.log("id",id)
  try {
    const provider = await User.findOne({ _id: id, role: "provider" })
      .select("-password")
      .populate({
        path: "subspecialty",
        populate: { path: "specialty" }
      })
      .populate({
        path: "clinics",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: { path: "city" }
          }
        }
      })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" }
        }
      })
      .populate("experiences")
      .populate("qualifications");

    if (!provider) {
      return res.status(404).json({ 
        success: false, 
        message: "Provider not found" 
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

      console.log("provider",provider?.availability)

    // Calculate ratings
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Combine all data
    const providerData = provider.toObject();
    
      console.log("providerData",providerData?.availability)

    providerData.services = services;
    providerData.reviews = reviews;
    providerData.statistics = {
      averageRating,
      totalReviews: reviews.length,
      totalServices: services.length
    };

    res.status(200).json({
      success: true,
      data: providerData,
      availability:provider?.availability
    });

  } catch (err) {
    console.error("Error in getProviderById:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const userPicture = async (req, res) => {
  const { imageUrl, publicId } = req.body;

  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (user && user.image && user.image.publicId) {
      await cloudinary.uploader.destroy(user.image.publicId);
    }

    user.image.publicId = publicId;
    user.image.url = imageUrl;
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
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

    // Delete provider services and their images
    const services = await ProviderService.find({ providerId: userId });
    for (const service of services) {
      if (service.image && service.image.publicId) {
        await cloudinary.uploader.destroy(service.image.publicId);
      }
    }
    await ProviderService.deleteMany({ providerId: userId });

    // Delete appointments where user is provider or client
    await Appointment.deleteMany({ $or: [{ providerId: userId }, { clientId: userId }] });

    // Delete related documents
    await Promise.all([
      Offer.deleteMany({ providerId: userId }),
      Review.deleteMany({ $or: [{ providerId: userId }, { clientId: userId }] }),
      ServiceBookingRequest.deleteMany({ $or: [{ providerId: userId }, { clientId: userId }] }),
    ]);

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "User and all related data deleted successfully" });
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



// ✅ KPI summary for provider dashboard
const getProviderKPI = async (req, res) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);

    // 🔹 1. Count unique patients
    const appointments = await Appointment.find({ providerId })
      .select("clientId")
      .lean();

    const uniquePatients = new Set(
      appointments.map(a => a.clientId?.toString()).filter(Boolean)
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
};
