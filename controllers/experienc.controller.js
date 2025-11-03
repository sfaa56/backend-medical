const Experience = require("../models/ExperienceSchema");
const User = require("../models/User");


const addExperience = async (req, res) => {
  try {
    const { userId } = req.params;
    const { jobTitle, hospital, startYear, endYear, currentlyWorking } = req.body;
    console.log("experience",currentlyWorking)

    const experience = await Experience.create({
      user: userId,
      jobTitle,
      hospital,
      startYear,
      endYear,
      currentlyWorking,
    });
    console.log("experience",experience)

    await User.findByIdAndUpdate(userId, { $push: { experiences: experience._id } });

    res.status(201).json({ message: "Experience added successfully", experience });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


const updateExperience = async (req, res) => {
  try {
    const { id } = req.params; // experience ID
    const updated = await Experience.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Experience not found" });

    res.json({ message: "Experience updated", updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


const deleteExperience = async (req, res) => {
  try {
    const { userId, id } = req.params;

    const experience = await Experience.findByIdAndDelete(id);
    if (!experience) return res.status(404).json({ message: "Experience not found" });

    await User.findByIdAndUpdate(userId, { $pull: { experiences: id } });

    res.json({ message: "Experience deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


const getExperiencesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const experiences = await Experience.find({ user: userId }).sort({ startYear: -1 });
    res.json(experiences);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


module.exports = {
    addExperience,
    updateExperience,
    deleteExperience,
    getExperiencesByUser
}