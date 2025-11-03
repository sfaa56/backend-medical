// controllers/clinicController.js
const Clinc = require("../models/Clinc");
const User = require("../models/User");

// ✅ Add clinic
exports.addClinic = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, postalCode, timeFrom, timeTo, day, clinicPhoto } = req.body;

    console.log("Adding clinic for user:", userId);

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Create the clinic
    const clinic = await Clinc.create({
      user: userId,
      name,
      postalCode,
      timeFrom,
      timeTo,
      day,
      clinicPhoto,
    });

    // Populate nested location info
    await clinic.populate({
      path: "postalCode",
      populate: {
        path: "district",
        populate: { path: "city" },
      },
    });

    // Add to user's clinics array
    await User.findByIdAndUpdate(userId, { $push: { clinics: clinic._id } });

    res.status(201).json({
      message: "Clinic added successfully",
      clinic,
    });
  } catch (error) {
    console.error("Error adding clinic:", error);
    res.status(500).json({
      message: "Failed to add clinic",
      error: error.message,
    });
  }
};

// ✅ Get clinics by user
exports.getClinicsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const clinics = await Clinc.find({ user: userId }).populate("postalCode");
    res.json(clinics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



// ✅ Update clinic
exports.updateClinic = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the clinic exists
    const clinic = await Clinc.findById(id);
    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    // Update the clinic with the provided data
    const updatedClinic = await Clinc.findByIdAndUpdate(id, req.body, {
      new: true, // return the updated document
      runValidators: true, // enforce schema validation
    })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      })
      .exec();

    res.status(200).json(
     updatedClinic
    );
  } catch (error) {
    console.error("Error updating clinic:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ✅ Delete clinic
exports.deleteClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic = await Clinc.findById(id);

    if (!clinic) {
      return res.status(404).json({ message: "Clinic not found" });
    }

    // ✅ Delete the clinic photo from Cloudinary if exists
    if (clinic.clinicPhoto?.publicId) {
      try {
        await cloudinary.uploader.destroy(clinic.clinicPhoto.publicId);
      } catch (cloudErr) {
        console.warn("⚠️ Cloudinary delete failed:", cloudErr.message);
      }
    }

    // ✅ Delete clinic from DB
    await Clinc.findByIdAndDelete(id);

    // ✅ Remove clinic reference from user
    await User.findByIdAndUpdate(clinic.user, { $pull: { clinics: id } });

    res.json({ message: "Clinic deleted successfully" });
  } catch (error) {
    console.error("Error deleting clinic:", error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.updateClinicPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { publicId, url } = req.body;

    const clinic = await Clinc.findById(id);
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });

    // ✅ حذف الصورة القديمة من Cloudinary (اختياري لو عايز)
    if (
      clinic.clinicPhoto?.publicId &&
      clinic.clinicPhoto.publicId !== publicId
    ) {
      await cloudinary.uploader.destroy(clinic.clinicPhoto.publicId);
    }

    // ✅ تحديث الصورة الجديدة في الداتا بيز
    clinic.clinicPhoto = { publicId, url };
    await clinic.save();

    res.json({ message: "Clinic photo updated successfully", clinic });
  } catch (error) {
    console.error("Error updating clinic photo:", error);
    res.status(500).json({ message: "Server error" });
  }
};




// GET doctor clinics (limit 2)
exports.getDoctorClinics = async (req, res) => {
  try {
    const clinics = await Clinc.find({ user: req.user.id })
      .limit(2)
      .populate("location");
    res.json(clinics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch clinics" });
  }
}
