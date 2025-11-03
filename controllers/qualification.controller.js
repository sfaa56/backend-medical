// controllers/qualificationController.js
const Qualification = require("../models/Qualification");
const User = require("../models/User");

// Create
exports.addQualification = async (req, res) => {
  const { userId } = req.params;
  try {
    const {  title, institution, dateObtained } = req.body;

    const qualification = await Qualification.create({
      user: userId,
      title,
      institution,
      dateObtained,
    });

    await User.findByIdAndUpdate(userId, {
      $push: { qualifications: qualification._id },
    });

    res.status(201).json(qualification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all by user
exports.getQualificationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const qualifications = await Qualification.find({ user: userId }).sort({
      dateObtained: -1,
    });
    res.json(qualifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update
exports.updateQualification = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Qualification.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete
exports.deleteQualification = async (req, res) => {
  try {
    const { id } = req.params;
    const qualification = await Qualification.findById(id);
    if (!qualification)
      return res.status(404).json({ message: "Qualification not found" });

    await Qualification.findByIdAndDelete(id);
    await User.findByIdAndUpdate(qualification.user, {
      $pull: { qualifications: id },
    });

    res.json({ message: "Qualification deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
