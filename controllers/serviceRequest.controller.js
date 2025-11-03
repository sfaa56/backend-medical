const ServiceRequest = require("../models/ServiceRequest");
const Joi = require("joi");
const cloudinary = require("../config/cloudinary");
const Review = require("../models/Review");
const Offer = require("../models/Offer");
const PostalCode = require("../models/PostalCode");
const mongoose = require("mongoose");

// ✅ Create Schema
const createRequestSchema = Joi.object({
  subSpecialty: Joi.string().required(),
  subCategory: Joi.string().required(),
  title: Joi.string().min(4).required(),
  description: Joi.string().min(3).required(),
  preferredTime: Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
  }),
  requirements: Joi.array().items(Joi.string()),

  attachments: Joi.array()
    .items(
      Joi.object({
        publicId: Joi.string().required(),
        url: Joi.string().required(),
      }).optional()
    )
    .optional(),

  patientDetails: Joi.object({
    name: Joi.string().required(),
    age: Joi.string().required(),
    gender: Joi.string().required(),
    medicalHistory: Joi.string().required(),
  }),

  place: Joi.string().required(),

  postalCode: Joi.string().required(),
  price: Joi.string().required(),
  priceType: Joi.string().valid("Hourly", "Session", "Visit").required(),
  currency: Joi.string().valid("USD", "EGP", "EUR"),
});

// ✅ Update Schema (fields optional)
const updateRequestSchema = Joi.object({
  subSpecialty: Joi.string(),
  subCategory: Joi.string(),
  title: Joi.string().min(4),
  description: Joi.string().min(3),
  preferredTime: Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
  }),
  requirements: Joi.array().items(Joi.string()),
  attachments: Joi.array()
    .items(
      Joi.object({
        publicId: Joi.string().required(),
        url: Joi.string().required(),
      }).optional()
    )
    .optional(),
  postalCode: Joi.string(),
  price: Joi.string().required(),
  priceType: Joi.string().valid("Hourly", "Session", "Visit"),
  currency: Joi.string().valid("USD", "EGP", "EUR"),

  patientDetails: Joi.object({
    name: Joi.string().required(),
    age: Joi.string().required(),
    gender: Joi.string().required(),
    medicalHistory: Joi.string().required(),
  }),
  place: Joi.string().required(),
});

const createRequest = async (req, res) => {
  const { error } = createRequestSchema.validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });

  if (req.user.role !== "client")
    return res.status(403).json({ success: false, message: "Access denied" });

  try {
    const request = new ServiceRequest({
      ...req.body,
      clientId: req.user.id,
    });

    const saved = await request.save();

    // 🟡 نعمل populate لنفس الـ document اللي اتحفظ
    const populatedRequest = await ServiceRequest.findById(saved._id)
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      })
      .populate({
        path: "subSpecialty",
        populate: { path: "specialty" },
      })
      .populate({
        path: "subCategory",
        populate: { path: "category" },
      })
      .populate({
        path: "offers",
        populate: { path: "providerId" },
      })
      .lean();

    res.status(201).json({ success: true, data: populatedRequest });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const parseIds = (value) => {
  if (!value) return null;
  const arr = value.split(",").map((v) => v.trim());
  return arr
    .filter((v) => mongoose.Types.ObjectId.isValid(v))
    .map((v) => new mongoose.Types.ObjectId(v));
};

const getAllRequests = async (req, res) => {
  console.log("req.query", req.query);
  try {
    const match = {};

    // 🧠 فلترة التخصصات
    const specialties = parseIds(req.query.specialty);
    const subSpecialties = parseIds(req.query.subspecialties);
    if (specialties?.length)
      match["subSpecialty.specialty"] = { $in: specialties };
    if (subSpecialties?.length)
      match["subSpecialty._id"] = { $in: subSpecialties };

    // 🧠 فلترة الكاتيجوري
    const categories = parseIds(req.query.category);
    const subCategories = parseIds(req.query.subcategory);
    if (categories?.length) match["subCategory.category"] = { $in: categories };
    if (subCategories?.length)
      match["subCategory._id"] = { $in: subCategories };

    if (req.query.serviceMethod) match.place = req.query.serviceMethod;

    // 💰 فلترة السعر
    if (req.query.minPrice || req.query.maxPrice) {
      match.price = {};
      if (req.query.minPrice) match.price.$gte = +req.query.minPrice;
      if (req.query.maxPrice) match.price.$lte = +req.query.maxPrice;
    }

    const pipeline = [
      // 🔗 Specialty/SubSpecialty joins
      {
        $lookup: {
          from: "subspecialties",
          localField: "subSpecialty",
          foreignField: "_id",
          as: "subSpecialty",
        },
      },
      { $unwind: "$subSpecialty" },

      {
        $lookup: {
          from: "specialties",
          localField: "subSpecialty.specialty",
          foreignField: "_id",
          as: "specialty",
        },
      },
      { $unwind: "$specialty" },

      // 🔗 Category/SubCategory joins
      {
        $lookup: {
          from: "subservicecategories",
          localField: "subCategory",
          foreignField: "_id",
          as: "subCategory",
        },
      },
      { $unwind: "$subCategory" },

      {
        $lookup: {
          from: "servicecategories",
          localField: "subCategory.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },

      // 🔗 PostalCode → District → City joins
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
          as: "postalCode.district",
        },
      },
      {
        $unwind: {
          path: "$postalCode.district",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "cities",
          localField: "postalCode.district.city",
          foreignField: "_id",
          as: "postalCode.district.city",
        },
      },
      {
        $unwind: {
          path: "$postalCode.district.city",
          preserveNullAndEmptyArrays: true,
        },
      },

      // ✅ رجّع كل حاجة nested جوه postalCode
      {
        $addFields: {
          postalCode: {
            _id: "$postalCode._id",
            code: "$postalCode.code",
            active: "$postalCode.active",
            district: {
              _id: "$postalCode.district._id",
              name: "$postalCode.district.name",
              active: "$postalCode.district.active",
              city: {
                _id: "$postalCode.district.city._id",
                name: "$postalCode.district.city.name",
                active: "$postalCode.district.city.active",
              },
            },
          },
        },
      },

      { $match: match },
    ];

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    // 🔍 بحث بالعنوان
    if (req.query.title) {
      pipeline.push({
        $match: { title: { $regex: req.query.title, $options: "i" } },
      });
    }

    // 📍 بحث بالموقع
    if (req.query.location) {
      const regex = new RegExp(req.query.location, "i");
      pipeline.push({
        $match: {
          $or: [
            { "postalCode.code": regex },
            { "postalCode.district.name": regex },
            { "postalCode.district.city.name": regex },
          ],
        },
      });
    }

    const requests = await ServiceRequest.aggregate(pipeline);

    res.status(200).json({ success: true, data: requests });
  } catch (err) {
    console.error("❌ Error in getAllRequests:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getRequestById = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id)
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      })
      .populate({
        path: "subSpecialty",
        populate: { path: "specialty" },
      })
      .populate({
        path: "subCategory",
        populate: { path: "category" },
      })
      .populate({
        path: "offers",
        populate: { path: "providerId" },
      })
      .lean();

    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });

    res.status(200).json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateRequest = async (req, res) => {
  const { error } = updateRequestSchema.validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });

  if (req.user.role !== "client" && req.user.role !== "admin")
    return res.status(403).json({ success: false, message: "Access denied" });

  try {
    const oldRequest = await ServiceRequest.findById(req.params.id);
    if (!oldRequest)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });

    // 🧩 Owner check (if not admin)
    if (
      req.user.role !== "admin" &&
      oldRequest.clientId.toString() !== req.user.id
    )
      return res.status(403).json({ success: false, message: "Access denied" });

    // 🖼️ Handle image updates
    const newAttachments = req.body.attachments || [];
    const oldAttachments = oldRequest.attachments || [];

    const removedAttachments = oldAttachments.filter(
      (oldImg) =>
        !newAttachments.some((newImg) => newImg.publicId === oldImg.publicId)
    );

    for (const img of removedAttachments) {
      try {
        await cloudinary.uploader.destroy(img.publicId);
      } catch (err) {
        console.error(
          `❌ Failed to delete image ${img.publicId}:`,
          err.message
        );
      }
    }

    // 🧩 Allow only specific fields
    const allowedFields = [
      "subSpecialty",
      "subCategory",
      "title",
      "description",
      "preferredTime",
      "requirements",
      "attachments",
      "PostalCode",
    ];

    const updateData = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    const updated = await ServiceRequest.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const deleteRequest = async (req, res) => {
  if (req.user.role !== "client" && req.user.role !== "admin")
    return res.status(403).json({ success: false, message: "Access denied" });

  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });

    if (
      req.user.role !== "admin" &&
      request.clientId.toString() !== req.user.id
    )
      return res.status(403).json({ success: false, message: "Access denied" });

    // check if there offer acepted but not completed yet

    const offerNotCompleted = Offer.findOne({
      serviceRequestId: request._id,
      status: "accepted",
    });

    if (offerNotCompleted) {
      return res
        .status(403)
        .json({
          success: false,
          message: "you have to complete your offer first",
        });
    }

    // 🧹 Mark offers as deleted
    await Offer.updateMany(
      { serviceRequestId: req.params.id },
      { $set: { status: "deleted" } }
    );

    // 🧹 Delete images from Cloudinary
    if (request.attachments?.length > 0) {
      for (const attachment of request.attachments) {
        await cloudinary.uploader.destroy(attachment.publicId);
      }
    }

    await ServiceRequest.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getRequestsByClientId = async (req, res) => {
  console.log("req.params", req.params);
  try {
    const requests = await ServiceRequest.find({
      clientId: req.params.id,
    })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      })
      .populate({
        path: "subSpecialty",
        populate: { path: "specialty" },
      })
      .populate({
        path: "subCategory",
        populate: { path: "category" },
      })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// KPI summary for the client
const getClientKPI = async (req, res) => {
  try {
    const clientId = req.user.id;

    // 1️⃣ Count Service Requests by Status
    const requestsByStatus = await ServiceRequest.aggregate([
      { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // 2️⃣ Get all request IDs for this client
    const clientRequests = await ServiceRequest.find({ clientId }).select(
      "_id title"
    );

    const requestIds = clientRequests.map((r) => r._id);

    // 3️⃣ Count Offers by Status (for those requests)
    const offers = await Offer.countDocuments({
      serviceRequestId: { $in: requestIds },
    });

    // 5️⃣ Format the data for the frontend
    const formatCounts = (arr) =>
      arr.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});

    res.json({
      success: true,
      data: {
        serviceRequests: formatCounts(requestsByStatus),
        offers: offers,
      },
    });
  } catch (error) {
    console.error("Error fetching client KPIs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching client KPIs",
    });
  }
};

module.exports = {
  createRequest,
  getAllRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
  getRequestsByClientId,
  getClientKPI,
};
