// controllers/providerServiceController.js
const ProviderService = require("../models/ProviderService");
const joi = require("joi");
const User = require("../models/User");
const { default: mongoose } = require("mongoose");
const BookingRequest = require("../models/BookingRequest");

// Validation schema
const providerServiceSchema = joi.object({
  title: joi.string().required(),
  place: joi.string().required(),

  price: joi.number().required(),
  priceType: joi.string().valid("Hourly", "Session").default("Session"),

  cuncurncey: joi.string().valid("USD", "EGP", "EUR").optional(),

  serviceCategory: joi.string().required(),
  subServiceCategory: joi.string().optional(),
  specialty: joi.string().required(),

  image: joi
    .object({
      publicId: joi.string().optional(),
      url: joi.string().optional(),
    })
    .optional(),
});

exports.createProviderService = async (req, res) => {
  const { error } = providerServiceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const providerId = req.user.id; // 👈 لو عندك JWT user id
    const service = new ProviderService({ ...req.body, providerId });
    await service.save();

    // ✅ أضف الخدمة للمستخدم
    await User.findByIdAndUpdate(providerId, {
      $push: { services: service._id },
    });

    // ✅ populate نفس ما نرجعها من الـ getUser
    const populatedService = await ProviderService.findById(service._id)
      .populate("serviceCategory")
      .populate("subServiceCategory")
      .populate("specialty");

    res.status(201).json(populatedService);
  } catch (error) {
    console.error("Error creating provider service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
// ✅ UPDATE CONTROLLER
exports.updateProviderService = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedService = await ProviderService.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    )
      .populate("serviceCategory")
      .populate("subServiceCategory")
      .populate("specialty");

    if (!updatedService) {
      return res.status(404).json({ error: "Service not found" });
    }

    res.status(200).json(updatedService);
  } catch (error) {
    console.error("Error updating provider service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ DELETE PROVIDER SERVICE
exports.deleteProviderService = async (req, res) => {
  const { id } = req.params; // service ID
  const userId = req.user.id; // from authentication middleware

  try {
    // 1️⃣ Find the service first
    const service = await ProviderService.findById(id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // 2️⃣ Check ownership (ensure the logged-in provider owns this service)
    if (service.providerId.toString() !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }


    // check if there is booking still in progress 
    const booking = BookingRequest.findOne({
      serviceId:service._id,
      status:"accepted"
    })

    if(booking){
      res.status(400).json({ error: "you have to complete your appointment first for this service" });
    }

    // 3️⃣ Delete the service document
    await ProviderService.findByIdAndDelete(id);

    // 4️⃣ Remove the reference from the user's services array
    await User.findByIdAndUpdate(userId, {
      $pull: { services: id },
    });

    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Error deleting provider service:", error);
    res
      .status(500)
      .json({ error: "Something went wrong while deleting service" });
  }
};

exports.getServicesByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const services = await ProviderService.find({
      provider: providerId,
    }).populate("serviceCategory");
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const parseIds = (val) => {
  if (!val) return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

exports.getAllServices = async (req, res) => {
  try {
    const matchTop = {};

    // ✅ price filter
    if (req.query.minPrice || req.query.maxPrice) {
      matchTop.price = {};
      if (req.query.minPrice) matchTop.price.$gte = +req.query.minPrice;
      if (req.query.maxPrice) matchTop.price.$lte = +req.query.maxPrice;
    }

    // ✅ direct filters
    if (req.query.priceType) matchTop.priceType = req.query.priceType;
    if (req.query.cuncurncey) matchTop.cuncurncey = req.query.cuncurncey;
    if (req.query.providerId && mongoose.Types.ObjectId.isValid(req.query.providerId)) {
      matchTop.providerId = new mongoose.Types.ObjectId(req.query.providerId);
    }

    // ✅ text filters
    if (req.query.title)
      matchTop.title = { $regex: req.query.title, $options: "i" };
    if (req.query.place)
      matchTop.place = { $regex: req.query.place, $options: "i" };

    // ✅ category filters
    const specialties = parseIds(req.query.specialty || req.query.specialties);
    const subServiceCategories = parseIds(
      req.query.subcategory || req.query.subServiceCategory || req.query.subspecialty
    );
    const serviceCategories = parseIds(
      req.query.category || req.query.serviceCategory
    );

    // ✅ pipeline
    const pipeline = [];
    if (Object.keys(matchTop).length) pipeline.push({ $match: matchTop });

    // Lookup subServiceCategory -> serviceCategory
    pipeline.push(
      {
        $lookup: {
          from: "subservicecategories",
          localField: "subServiceCategory",
          foreignField: "_id",
          as: "subServiceCategory",
        },
      },
      { $unwind: { path: "$subServiceCategory", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "servicecategories",
          localField: "subServiceCategory.category",
          foreignField: "_id",
          as: "serviceCategory",
        },
      },
      { $unwind: { path: "$serviceCategory", preserveNullAndEmptyArrays: true } },
      // Lookup specialty
      {
        $lookup: {
          from: "specialties",
          localField: "specialty",
          foreignField: "_id",
          as: "specialty",
        },
      },
      { $unwind: { path: "$specialty", preserveNullAndEmptyArrays: true } },
      // Lookup provider and join subspecialty, postal info
      {
        $lookup: {
          from: "users",
          let: { providerId: "$providerId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$providerId"] } } },
            // Subspecialty lookup
            {
              $lookup: {
                from: "subspecialties",
                localField: "subspecialty",
                foreignField: "_id",
                as: "subspecialty",
              },
            },
            {
              $addFields: {
                firstSubspecialty: { $arrayElemAt: ["$subspecialty", 0] },
              },
            },
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
            { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                image: 1,
                specialty: 1,
                subspecialty: "$firstSubspecialty",
                postalCode: { _id: 1, code: 1 },
                district: { _id: 1, name: 1 },
                city: { _id: 1, name: 1 },
              },
            },
          ],
          as: "provider",
        },
      },
      { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
      // Clean up structure
      {
        $addFields: {
          serviceCategory: { _id: "$serviceCategory._id", name: "$serviceCategory.name" },
          subServiceCategory: { _id: "$subServiceCategory._id", name: "$subServiceCategory.name" },
          specialty: { _id: "$specialty._id", name: "$specialty.name" },
          "provider.subspecialty": {
            _id: "$provider.subspecialty._id",
            name: "$provider.subspecialty.name",
          },
        },
      },
      // Final project
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          price: 1,
          priceType: 1,
          cuncurncey: 1,
          place: 1,
          image: 1,
          createdAt: 1,
          serviceCategory: 1,
          subServiceCategory: 1,
          specialty: 1,
          provider: 1,
        },
      }
    );

    // Post-filtering by categories
    const matchAfter = {};
    if (serviceCategories.length) matchAfter["serviceCategory._id"] = 
    { $in: serviceCategories.map(id => new mongoose.Types.ObjectId(id)) };
    if (subServiceCategories.length) matchAfter["subServiceCategory._id"] = 
    { $in: subServiceCategories.map(id => new mongoose.Types.ObjectId(id)) };
    if (specialties.length) matchAfter["specialty._id"] = { $in: specialties.map(id => new mongoose.Types.ObjectId(id)) };
    if (Object.keys(matchAfter).length) pipeline.push({ $match: matchAfter });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "20", 10));
    const skip = (page - 1) * limit;
    pipeline.push({ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit });

    // Execute aggregation
    const services = await ProviderService.aggregate(pipeline);

    res.status(200).json({
      success: true,
      meta: { page, limit, count: services.length },
      data: services,
    });
  } catch (err) {
    console.error("Error in getAllServices:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ GET SERVICE BY ID
exports.getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, message: "Invalid service ID" });
    }

    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(serviceId) } },
      {
        $lookup: {
          from: "subservicecategories",
          localField: "subServiceCategory",
          foreignField: "_id",
          as: "subServiceCategory",
        },
      },
      { $unwind: { path: "$subServiceCategory", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "servicecategories",
          localField: "subServiceCategory.category",
          foreignField: "_id",
          as: "serviceCategory",
        },
      },
      { $unwind: { path: "$serviceCategory", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "specialties",
          localField: "specialty",
          foreignField: "_id",
          as: "specialty",
        },
      },
      { $unwind: { path: "$specialty", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          let: { providerId: "$providerId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$providerId"] } } },
            {
              $lookup: {
                from: "subspecialties",
                localField: "subspecialty",
                foreignField: "_id",
                as: "subspecialty",
              },
            },
            {
              $addFields: {
                firstSubspecialty: { $arrayElemAt: ["$subspecialty", 0] },
              },
            },
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
            { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                image: 1,
                specialty: 1,
                subspecialty: "$firstSubspecialty",
                postalCode: { _id: 1, code: 1 },
                district: { _id: 1, name: 1 },
                city: { _id: 1, name: 1 },
              },
            },
          ],
          as: "provider",
        },
      },
      { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          serviceCategory: { _id: "$serviceCategory._id", name: "$serviceCategory.name" },
          subServiceCategory: { _id: "$subServiceCategory._id", name: "$subServiceCategory.name" },
          specialty: { _id: "$specialty._id", name: "$specialty.name" },
          "provider.subspecialty": {
            _id: "$provider.subspecialty._id",
            name: "$provider.subspecialty.name",
          },
        },
      },
      {
        $project: {
          _id: 1,
          bookings:1,
          title: 1,
          description: 1,
          price: 1,
          priceType: 1,
          cuncurncey: 1,
          place: 1,
          image: 1,
          createdAt: 1,
          serviceCategory: 1,
          subServiceCategory: 1,
          specialty: 1,
          provider: 1,
        },
      },
    ];

    const service = await ProviderService.aggregate(pipeline);

    if (!service.length) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.status(200).json({ success: true, data: service[0] });
  } catch (error) {
    console.error("Error fetching service by ID:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

