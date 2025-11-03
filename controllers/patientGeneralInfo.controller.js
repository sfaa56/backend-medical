const PatientGeneralInfo = require("../models/PatientGeneralInfo");

// ✅ Get general info
exports.getGeneralInfo = async (req, res) => {
      const { clientId } = req.params; // doctor passes patientId
  try {
    const info = await PatientGeneralInfo.findOne({ clientId: clientId });
    res.status(200).json({ success: true, data: info });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Create / Update general info
exports.updatechronicConditions = async (req, res) => {
  try {
    const data = req.body;
    const updated = await PatientGeneralInfo.findOneAndUpdate(
      { clientId: req.user.id },
      { chronicConditions: data.chronicConditions },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Add Surgery
exports.addSurgery = async (req, res) => {
  try {
    const info = await PatientGeneralInfo.findOne({ clientId: req.user.id });
    info.pastSurgeries.push(req.body);
    await info.save();
       const newSurgery = info.pastSurgeries[info.pastSurgeries.length - 1];
    res.status(200).json({ success: true, data: newSurgery });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Add Allergy
exports.addAllergy = async (req, res) => {
  try {
    const info = await PatientGeneralInfo.findOne({ clientId: req.user.id });
    info.allergies.push(req.body);
    await info.save();
      const newAllergy = info.allergies[info.allergies.length - 1];
    res.status(200).json({ success: true, data: newAllergy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// delete Allergy
exports.deleteAllergy = async (req, res) => {
  try {
    const info = await PatientGeneralInfo.findOne({ clientId: req.user.id });
    info.allergies = info.allergies.filter(
      (a) => a._id.toString() !== req.params.allergyId
    );
    await info.save();
    res.status(200).json({ success: true, data: req.params.allergyId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// delete Surgery
exports.deleteSurgery = async (req, res) => {
  try {
    const info = await PatientGeneralInfo.findOne({ clientId: req.user.id });
    info.pastSurgeries = info.pastSurgeries.filter(
      (s) => s._id.toString() !== req.params.surgeryId
    );
    await info.save();
    res.status(200).json({ success: true, data: req.params.surgeryId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
