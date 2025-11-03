// controllers/specialtyController.js
const { cloudinary_js_config } = require("../config/cloudinary");
const ProviderService = require("../models/ProviderService");
const ServiceCategory = require("../models/ServiceCategory");
const ServiceRequest = require("../models/ServiceRequest");
const Specialty = require("../models/Speicalty");
const SubSpecialty = require("../models/Sub-specialties");
const User = require("../models/User");

exports.createSpecialty = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const { specialty, subSpecialties } = req.body;
    const newSpecialty = new Specialty({ name: specialty });
    await newSpecialty.save();

    if (subSpecialties && subSpecialties.length > 0) {
      const subSpecialtyPromises = subSpecialties.map((sub) => {
        console.log("sub", sub);
        return new SubSpecialty({
          name: sub.name,
          specialty: newSpecialty._id,
        }).save();
      });
      await Promise.all(subSpecialtyPromises);
    }

    const dataResult = {
      ...newSpecialty.toObject(),
      subSpecialties: subSpecialties || [],
    };

    res.status(201).json(dataResult);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateSpecialty = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { id } = req.params;
    const { specialty, subSpecialties } = req.body;

    const updatedSpecialty = await Specialty.findByIdAndUpdate(
      id,
      { name: specialty },
      { new: true }
    );

    if (!updatedSpecialty) {
      return res.status(404).json({ message: "Specialty not found" });
    }

    // 🟡 كل الـ SubSpecialties القديمة المرتبطة بالتخصص ده
    const subSpecialtyIds = await SubSpecialty.find({ specialty: id }).distinct(
      "_id"
    );

    const subSpecialtiesToTrack = [];

    // 🔵 معالجة الـ SubSpecialties اللي جاية من الـ body
    if (subSpecialties && subSpecialties.length > 0) {
      for (const sub of subSpecialties) {
        if (sub._id) {
          // تحديث الموجود
          await SubSpecialty.findByIdAndUpdate(sub._id, {
            name: sub.name,
            specialty: updatedSpecialty._id,
          });
          subSpecialtiesToTrack.push(sub._id);
        } else {
          // إنشاء جديد
          const newSubSpecialty = new SubSpecialty({
            name: sub.name,
            specialty: updatedSpecialty._id,
          });
          await newSubSpecialty.save();
          subSpecialtiesToTrack.push(newSubSpecialty._id);
        }
      }
    }

    // 🔴 تحديد الـ SubSpecialties اللي المفروض تتشال
    const toDelete = subSpecialtyIds.filter(
      (subId) => !subSpecialtiesToTrack.map(String).includes(String(subId))
    );

    // 🟣 التحقق من وجود مستخدمين مرتبطين بأي SubSpecialty من دول
    const linkedUsers = await User.find({
      subspecialty: { $in: toDelete },
    }).populate("subspecialty", "name");

    if (linkedUsers.length > 0) {
      return res.status(400).json({
        message:
          "Cannot remove some sub-specialties because they are linked to users.",
        linkedSubSpecialties: linkedUsers.map((u) => ({
          _id: u.subspecialty._id,
          name: u.subspecialty.name,
          user: u._id,
        })),
      });
    }

    // 🟢 لو مفيش ارتباطات، احذفهم عادي
    await SubSpecialty.deleteMany({ _id: { $in: toDelete } });

    const dataResult = {
      ...updatedSpecialty.toObject(),
      subSpecialties: subSpecialtiesToTrack,
    };

    res.status(200).json(dataResult);
  } catch (error) {
    console.error("Error updating specialty:", error);
    res.status(400).json({ error: error.message });
  }
};

exports.getAllSpecialties = async (req, res) => {
  try {
    const specialties = await Specialty.aggregate([
      // ✅ Populate subSpecialties
      {
        $lookup: {
          from: "subspecialties", // Collection name
          localField: "_id",
          foreignField: "specialty",
          as: "subSpecialties",
        },
      },
      // ✅ Populate categories
      {
        $lookup: {
          from: "servicecategories", // Collection name for ServiceCategory
          localField: "categories",
          foreignField: "_id",
          as: "categories",
        },
      },
    ]);

    res.json(specialties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSpecialty = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const { id } = req.params;

    // 🟣 أول حاجة: نتحقق إذا كانت الـspecialty موجودة
    const existingSpecialty = await Specialty.findById(id);
    if (!existingSpecialty) {
      return res.status(404).json({ message: "Specialty not found" });
    }

    // 🟠 نتحقق إذا كانت تحتوي على categories مرتبطة
    const relatedCategories = await ServiceCategory.find({ specialty: id });
    if (relatedCategories.length > 0) {
      return res.status(400).json({
        message:
          "Cannot delete this specialty because it still has categories linked to it. Please remove or reassign those categories first.",
        relatedCategories: relatedCategories.map((c) => ({
          _id: c._id,
          name: c.name,
        })),
      });
    }

    // check if ther are users linked to any sub-specialties of this specialty
    const subSpeciallties = await SubSpecialty.find({specialty:id}).distinct("_id");
    const linkedUsers = await User.find({
      subspecialty:{$in:subSpeciallties}
    });

    if(linkedUsers.length>0){
      return res.status(400).json({
        message:"Cannot delete this spcialty because some of its sub-specialties are linked to users."
      })
    }

    // check if there are service requests linked to any sub-specialties of this specialty
    const linkedServiceRequests = await ServiceRequest.find({
      subSpecialty:{$in:subSpeciallties}
    })

    if(linkedServiceRequests.length>0){
      return res.status(400).json({
        message:'Cannot delete this specialty because some of its sub-specialties are linked to service requests.'
      })
    }

    

    // 🔵 نحذف كل الـsub-specialties المرتبطة بيها
    await SubSpecialty.deleteMany({ specialty: id });

    // 🔴 نحذف الـspecialty نفسها
    await Specialty.findByIdAndDelete(id);

    res.status(200).json({
      message: "Specialty and its sub-specialties deleted successfully",
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// delete secialty from the user model and its sub-specialty and its services from the provider service model
exports.deleteSpecialtyFromUser = async (req, res) => {
  const { specialtyId } = req.params;
  const userId = req.user.id;
  try {
    // 1️⃣ Find related SubSpecialties
    const subsToDelete = await SubSpecialty.find({ specialty: specialtyId }).distinct("_id");

    if (subsToDelete.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { subspecialty: { $in: subsToDelete } },
      });
    }

    // 2️⃣ Get all ProviderServices (full documents, not just IDs)
    const servicesToDelete = await ProviderService.find({
      specialty: specialtyId,
      providerId: userId,
    });

    if (servicesToDelete.length > 0) {
      // 3️⃣ Delete images from Cloudinary
      for (const service of servicesToDelete) {
        if (service.image?.publicId) {
          try {
            await cloudinary_js_config.uploader.destroy(service.image.publicId);
            console.log(`🗑 Deleted image: ${service.image.publicId}`);
          } catch (err) {
            console.error(`⚠️ Failed to delete image ${service.image.publicId}:`, err.message);
          }
        }
      }

      // 4️⃣ Delete services from DB
      const serviceIds = servicesToDelete.map((s) => s._id);
      await ProviderService.deleteMany({ _id: { $in: serviceIds } });

      // 5️⃣ Remove references from user
      await User.findByIdAndUpdate(userId, {
        $pull: { services: { $in: serviceIds } },
      });
    }

    return res.status(200).json({
      message: "✅ Specialty, related sub-specialties, services, and images removed successfully.",
    });
  } catch (error) {
    console.error("❌ Error in deleteSpecialtyFromUser:", error);
    return res.status(500).json({
      error: "Failed to delete specialty and related data",
    });
  }
};





exports.getSpecialtyStats = async (req, res) => {
  try {
    const stats = await Specialty.aggregate([
      // 1) Lookup subspecialties that belong to each specialty
      {
        $lookup: {
          from: "subspecialties",
          localField: "_id",
          foreignField: "specialty",
          as: "subSpecialties",
        },
      },

      // 2) Lookup providers that belong to THIS specialty (use let + pipeline)
      {
        $lookup: {
          from: "users",
          let: { specialtyId: "$_id" }, // <- important: pass current specialty id
          pipeline: [
            // Only providers
            { $match: { role: "provider" } },

            // Make sure subspecialty is always an array (defensive)
            {
              $addFields: {
                subspecialty: {
                  $cond: [
                    { $isArray: "$subspecialty" },
                    "$subspecialty",
                    {
                      $cond: [
                        { $ifNull: ["$subspecialty", false] },
                        ["$subspecialty"],
                        []
                      ]
                    }
                  ]
                }
              }
            },

            // Lookup the subspecialty documents for this provider (so we can check their 'specialty' field)
            {
              $lookup: {
                from: "subspecialties",
                localField: "subspecialty",
                foreignField: "_id",
                as: "providerSubs"
              }
            },

            // Keep only providers that have at least one providerSubs.specialty === $$specialtyId
            {
              $match: {
                $expr: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$providerSubs",
                          as: "ps",
                          cond: { $eq: ["$$ps.specialty", "$$specialtyId"] }
                        }
                      }
                    },
                    0
                  ]
                }
              }
            },

            // Optional: project only fields we need (reduce size)
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                subspecialty: 1
              }
            }
          ],
          as: "providers" // providers that belong to the current specialty
        }
      },

      // 3) For each subspecialty, count how many of the above providers include that subspecialty id
      {
        $addFields: {
          subSpecialties: {
            $map: {
              input: "$subSpecialties",
              as: "sub",
              in: {
                _id: "$$sub._id",
                name: "$$sub.name",
                providerCount: {
                  $size: {
                    $filter: {
                      input: "$providers",
                      as: "prov",
                      // prov.subspecialty is forced to be an ARRAY earlier, so this $in is safe
                      cond: { $in: ["$$sub._id", "$$prov.subspecialty"] }
                    }
                  }
                }
              }
            }
          },
          totalProviders: { $size: "$providers" }
        }
      },

      // 4) Return only the fields you likely need (clean)
      {
        $project: {
          __v: 0,
          // keep _id, name, subSpecialties, totalProviders, categories, description (if present)
          // adjust to remove categories if you don't want it:
          // categories: 0
        }
      }
    ]);

    return res.status(200).json(stats);
  } catch (err) {
    console.error("Aggregation Error:", err);
    return res.status(500).json({
      message: "Failed to get specialty stats",
      error: err.message,
    });
  }
};


