// controllers/specialtyController.js
const Specialty = require("../models/Speicalty");
const SubSpecialty = require("../models/Sub-specialties");

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

    const subSpecialtyIds = await SubSpecialty.find({ specialty: id }).distinct(
      "_id"
    );

    console.log("subSpecialtyIds", subSpecialtyIds);

    const subSpecialtiesToTrack = [];

    if (subSpecialties && subSpecialties.length > 0) {
      for (const sub of subSpecialties) {
        if (sub._id) {
          // Update existing sub-specialty
          await SubSpecialty.findByIdAndUpdate(sub._id, {
            name: sub.name,
            specialty: updatedSpecialty._id,
          });
          subSpecialtiesToTrack.push(sub._id);
        } else {
          // Create new sub-specialty
          const newSubSpecialty = new SubSpecialty({
            name: sub.name,
            specialty: updatedSpecialty._id,
          });
          await newSubSpecialty.save();
          subSpecialtiesToTrack.push(newSubSpecialty._id);
        }
      }
    }
    console.log("subSpecialtiesToTrack", subSpecialtiesToTrack);

    // Delete sub-specialties that are no longer in the request
    for (const subId of subSpecialtyIds) {
      if (!subSpecialtiesToTrack.map(String).includes(String(subId))) {
        await SubSpecialty.findByIdAndDelete(subId);
      }
    }

    dataResult = {
      ...updatedSpecialty.toObject(),
      subSpecialties: subSpecialtiesToTrack,
    };

    res.status(200).json(dataResult);
  } catch (error) {
    console.log("Error updating specialty:", error);
    res.status(400).json({ error: error.message });
  }
};

exports.getAllSpecialties = async (req, res) => {
  try {
    const specialties = await Specialty.aggregate([
      {
        $lookup: {
          from: "subspecialties", // Collection name in MongoDB (usually plural and lowercase)
          localField: "_id",
          foreignField: "specialty",
          as: "subSpecialties",
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
    const deletedSpecialty = await Specialty.findByIdAndDelete(id);

    if (!deletedSpecialty) {
      return res.status(404).json({ message: "Specialty not found" });
    }

    // Delete all sub-specialties associated with this specialty
    await SubSpecialty.deleteMany({ specialty: id });

    res.status(200).json({ message: "Specialty and its sub-specialties deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}