// controllers/serviceCategoryController.js
const ServiceCategory = require("../models/ServiceCategory");
const User = require("../models/User");

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
