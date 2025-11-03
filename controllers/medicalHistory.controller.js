const MedicalHistory = require("../models/MedicalHistory");

exports.getHistoryByClient = async (req, res) => {
  try {
    const histories = await MedicalHistory.find({
      clientId: req.user.id,
    }).populate("providerId appointmentId");
    res.status(200).json({ success: true, data: histories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePrescription = async (req, res) => {
  try {
    const { id, prescriptionId } = req.params;
    const { medicationName, dosage, duration, instruction } = req.body;

    const history = await MedicalHistory.findById(id);
    if (!history) return res.status(404).json({ message: "Not found" });

    const prescription = history.prescriptions.id(prescriptionId);

    if (!prescription)
      return res.status(404).json({ message: "Prescription not found" });

    prescription.medicationName = medicationName || prescription.medicationName;
    prescription.dosage = dosage || prescription.dosage;
    prescription.duration = duration || prescription.duration;
    prescription.instruction = instruction || prescription.instruction;

    await history.save();
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ message: err.message });
  }
};


exports.deletePrescription = async (req, res) => {
  try {
    const { id, prescriptionId } = req.params;

    const history = await MedicalHistory.findById(id);
    if (!history) return res.status(404).json({ message: "Not found" });

    history.prescriptions = history.prescriptions.filter(
      (p) => p._id.toString() !== prescriptionId
    );
    await history.save();

    res.status(200).json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};






