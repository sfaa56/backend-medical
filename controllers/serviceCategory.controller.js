// controllers/serviceCategoryController.js
const ProviderService = require("../models/ProviderService");
const ServiceCategory = require("../models/ServiceCategory");
const ServiceRequest = require("../models/ServiceRequest");
const Specialty = require("../models/Speicalty");
const SubServiceCategory = require("../models/Sub-ServiceCategory");

const User = require("../models/User");

// 🟢 Create a new Service Category + optional Subcategories
exports.createServiceCategory = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { name, specialty, subCategories } = req.body;

    // 1️⃣ إنشاء الكاتيجوري الرئيسية
    const newCategory = new ServiceCategory({
      name,
      specialty,
    });

    await newCategory.save();

    // 2️⃣ ربط الكاتيجوري بالـspecialty
    await Specialty.findByIdAndUpdate(specialty, {
      $push: { categories: newCategory._id },
    });

    // 3️⃣ إنشاء الـsubcategories لو موجودة
    let createdSubs = [];
    if (subCategories && subCategories.length > 0) {
      const subPromises = subCategories.map((sub) =>
        new SubServiceCategory({
          name: sub,
          category: newCategory._id,
        }).save()
      );
      createdSubs = await Promise.all(subPromises);
    }

    // 4️⃣ populate للـspecialty
    const populatedCategory = await ServiceCategory.findById(newCategory._id)
      .populate("specialty")
      .lean();

    // 5️⃣ دمج الـsubcategories اللي لسه اتعملت
    res.status(201).json({
      ...populatedCategory,
      subCategories: createdSubs.map((sub) => ({
        _id: sub._id,
        name: sub.name,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};

// 🟡 Update Category and its Subcategories
exports.updateServiceCategory = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { id } = req.params;
    const { name, specialty, subCategories } = req.body;

    const oldCategory = await ServiceCategory.findById(id);

    if (!oldCategory)
      return res.status(404).json({ message: "Category not found" });

    const updatedCategory = await ServiceCategory.findByIdAndUpdate(
      id,
      { name, specialty },
      { new: true }
    ).populate("specialty");

    // 🟣 لو الـspecialty اتغيرت
    if (String(oldCategory.specialty) !== String(specialty)) {
      await Specialty.findByIdAndUpdate(oldCategory.specialty, {
        $pull: { categories: id },
      });
      await Specialty.findByIdAndUpdate(specialty, {
        $push: { categories: id },
      });
    }

    if (!updatedCategory)
      return res.status(404).json({ message: "Category not found" });

    const existingSubs = await SubServiceCategory.find({
      category: id,
    }).distinct("_id");

    const trackedSubs = [];

    if (subCategories && subCategories.length > 0) {
      for (const sub of subCategories) {
        if (sub._id) {
          await SubServiceCategory.findByIdAndUpdate(sub._id, {
            name: sub,
            category: updatedCategory._id,
          });
          trackedSubs.push({ _id: sub._id, name: sub.name });
        } else {
          const newSub = await new SubServiceCategory({
            name: sub,
            category: updatedCategory._id,
          }).save();
          trackedSubs.push({ _id: newSub._id, name: newSub.name });
        }
      }
    }

    // Delete removed subs
    for (const subId of existingSubs) {
      if (!trackedSubs.map(String).includes(String(subId))) {
        // قبل ما نحذف، نتأكد إنه مفيش ServiceRequests مرتبطة بيه
        const linkedRequests = await ServiceRequest.findOne({
          subCategory: subId,
        });
        if (linkedRequests) {
          return res.status(400).json({
            message: `Cannot delete subcategory linked to service requests`,
          });
        }

        // check if there are providerServices linked to this subcategory
        const linkedServices = await ProviderService.findOne({
          subServiceCategory: subId,
        });
        if (linkedServices) {
          return res.status(400).json({
            message: `Cannot delete subcategory linked to provider services`,
          });
        }

        await SubServiceCategory.findByIdAndDelete(subId);
      }
    }

    res.status(200).json({
      ...updatedCategory.toObject(),
      subCategories: trackedSubs,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🟣 Get all Categories with SubCategories and Specialty
exports.getAllServiceCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.aggregate([
      {
        $lookup: {
          from: "subservicecategories",
          let: { categoryId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$category", "$$categoryId"] } } },
          ],
          as: "subCategories",
        },
      },
      {
        $lookup: {
          from: "specialties",
          localField: "specialty",
          foreignField: "_id",
          as: "specialty",
        },
      },
      { $unwind: "$specialty" },
      {
        $project: {
          _id: 1,
          name: 1,
          specialty: { _id: 1, name: 1 },
          subCategories: 1,
        },
      },
    ]);

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔴 Delete Category + SubCategories
exports.deleteServiceCategory = async (req, res) => {
  console.log("req.user", req.user.role);
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { id } = req.params;

    // 🟢 نجيب الكاتيجوري عشان نعرف الـspecialty المرتبطة بيها
    const category = await ServiceCategory.findById(id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    // check if there are providerSevices linked to this category
    const linkedServices = await ProviderService.findOne({
      serviceCategory: id,
    });

    if (linkedServices) {
      return res.status(400).json({
        message: "Cannot delete category with linked provider services",
      });
    }

    // check if there are subcategories with linked service requests
    const subCategories = await SubServiceCategory.find({
      category: id,
    }).distinct("_id");

    const linkedRequests = await ServiceRequest.findOne({
      subCategory: { $in: subCategories },
    });

    if (linkedRequests) {
      return res.status(400).json({
        message: "Cannot delete category with linked service requests",
      });
    }

    // 🟠 نحذف الكاتيجوري نفسها
    await ServiceCategory.findByIdAndDelete(id);

    // 🔵 نحذف كل subCategories المرتبطة بيها
    await SubServiceCategory.deleteMany({ category: id });

    // 🔴 نشيل الـID من specialty.categories
    await Specialty.findByIdAndUpdate(category.specialty, {
      $pull: { categories: id },
    });

    res
      .status(200)
      .json({ message: "Category and subcategories deleted successfully" });
  } catch (error) {
    console.log("err", error);
    res.status(400).json({ error: "Something went wrong" });
  }
};

exports.createCategory = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { name, description, specialty } = req.body;
    const category = new ServiceCategory({ name, description, specialty });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getCategoriesBySpecialty = async (req, res) => {
  try {
    const { specialtyId } = req.params;
    const categories = await ServiceCategory.find({ specialty: specialtyId });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
