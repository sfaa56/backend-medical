const MedicalHistoryRecord = require("../models/MedicalHistory");
const cloudinary = require("../config/cloudinary");

// ✅ Get all history records (for a patient)
exports.getHistoryByClient = async (req, res) => {
  try {
    const clientId = req.user.id;
    const records = await MedicalHistoryRecord.find({ clientId })
      .populate("providerId appointmentId", "name date")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Flatten prescriptions for the Prescriptions tab
exports.getAllPrescriptionsByClient = async (req, res) => {
  try {
    const clientId = req.user.id;
    const records = await MedicalHistoryRecord.find({ clientId })
      .populate("providerId appointmentId", "name date diagnosis").sort({
        createdAt:-1
      })
      .lean();

    const prescriptions = records.flatMap((record) =>
      record.prescriptions.map((p) => ({
        ...p,
        provider: record.providerId,
        appointment: record.appointmentId,
        diagnosis: record.diagnosis,
        appointmentDate: record.appointmentId?.date,
      }))
    );

    res.status(200).json({ success: true, data: prescriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Flatten lab orders for Lab tab
exports.getAllLabOrdersByClient = async (req, res) => {
  try {
    const clientId = req.user.id;
    const records = await MedicalHistoryRecord.find({ clientId })
      .populate("providerId appointmentId", "name date")
      .lean().sort({
        createdAt:-1
      });

    if (!records) {
      return res.status(404).json({ message: "Not found" });
    }

    console.log("records", records);

    const labs = records.flatMap((record) =>
      record.lapOrders.map((l) => ({
        ...l,
        provider: record.providerId,
        appointmentDate: record.appointmentId?.date,
        appointment: record.appointmentId,
        recordId: record._id,
      }))
    );

    res.status(200).json({ success: true, data: labs });
  } catch (err) {
    console.log("error", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Provider adds prescription (after appointment)
exports.addPrescription = async (req, res) => {
  try {
    const { clientId } = req.params;
    const providerId = req.user.id;

     const record = await MedicalHistoryRecord.findOne({ providerId, clientId }).sort({ createdAt: -1 });
     if (!record) return res.status(404).json({ message: "Not found" });

  

    if (!req.body.medicationName || !req.body.dosage) {
      return res
        .status(400)
        .json({ message: "medicationName and dosage are required" });
    }

    if (req.user.id.toString() !== record.providerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    record.prescriptions.push({ ...req.body, createdFrom: "post" });
    await record.save();
    const newPres = record.prescriptions[record.prescriptions.length - 1];
    const data = { ...newPres.toObject(), recordId: record._id };

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ✅ Provider edits an existing prescription
exports.editPrescription = async (req, res) => {
  try {
    const { recordId, prescriptionId } = req.params;
    console.log("req.params",req.params)
    const record = await MedicalHistoryRecord.findById(recordId);
    if (!record) return res.status(404).json({ message: "Not found" });

    if (req.user.id.toString() !== record.providerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const pres = record.prescriptions.id(prescriptionId);
    if (!pres) return res.status(404).json({ message: "Prescription not found" });

    // whitelist updatable fields
    const updatable = [
      "medicationName",
      "dosage",
      "frequency",
      "duration",
      "notes",
      "instructions",
      "createdFrom",
    ];

    updatable.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        pres[field] = req.body[field];
      }
    });

    await record.save();
    res.status(200).json({ success: true, data: pres });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Provider deletes a prescription
exports.deletePrescription = async (req, res) => {
  try {
    const { recordId, prescriptionId } = req.params;
    const record = await MedicalHistoryRecord.findById(recordId);
    if (!record) return res.status(404).json({ message: "Not found" });

    if (req.user.id.toString() !== record.providerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // safe removal when subdoc.remove() isn't available
    const idx = record.prescriptions.findIndex(
      (p) => p._id && p._id.toString() === prescriptionId
    );
    if (idx === -1) return res.status(404).json({ message: "Prescription not found" });

    record.prescriptions.splice(idx, 1);
    await record.save();

    return res.status(200).json({ success: true, data: prescriptionId });
  } catch (err) {
    console.log("err", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



// ✅ Provider adds lab order
exports.addLabOrder = async (req, res) => {
  try {

    const { clientId } = req.params;
    const providerId = req.user.id;

   const record = await MedicalHistoryRecord.findOne({ providerId, clientId }).sort({ createdAt: -1 });
    if (!record) return res.status(404).json({ message: "Not found" });

    if (req.user.id.toString() !== record.providerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    console.log("record",record)

    record.lapOrders.push({ ...req.body, createdFrom: "post" });

    await record.save();
    const lab = record.lapOrders[record.lapOrders.length - 1];

    res.status(200).json({ success: true, data: lab });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Client uploads lab result
exports.uploadLabResult = async (req, res) => {
  try {
    const { recordId, labId } = req.params;
    const { filess } = req.body;

    if (!Array.isArray(filess) || filess.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files provided" });
    }

    const record = await MedicalHistoryRecord.findById(recordId);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const lab = record.lapOrders.id(labId);
    if (!lab) return res.status(404).json({ message: "Lab not found" });

    if (req.user.id.toString() !== record.clientId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }



    // lab.files
    const removedFiles = lab.files.filter(
      (oldFile)=>
        !filess.some((newFile)=> newFile.publicId === oldFile.publicId)
    )




    for (const file of removedFiles){
      try {
        await cloudinary.uploader.destroy(file.publicId);
      } catch (error) {
                console.error(
          `❌ Failed to delete image ${file.publicId}:`,
          err.message
        );
      }
    }

    lab.files = filess

    await record.save();
    res.status(200).json({ success: true, data: lab });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// get vitals by client
exports.getVitalsByClient = async (req, res) => {
  try {
    const clientId = req.user.id;

    const records = await MedicalHistoryRecord.find({ clientId })
      .populate("providerId appointmentId", "firstName lastName date diagnosis")
      .sort({createdAt:-1})
      .lean();

    console.log("records", records);

    const vitals = records.map((record) => ({
      ...record.vitals,
      provider: record.providerId,
      appointment: record.appointmentId,
      diagnosis: record.diagnosis,
      appointmentDate: record.appointmentId?.date,
      createdAt: record.createdAt,
    }));

    res.status(200).json({ success: true, data: vitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// get prescription by client for provider 
exports.getPrescriptionsByClientForProvider = async (req, res) => {
  try {
    const { clientId } = req.params;
    const records = await MedicalHistoryRecord.find({ clientId,providerId:req.user.id })
      .populate("providerId appointmentId", "name date diagnosis")
      .sort({createdAt:-1})
      .lean();

    const prescriptions = records.flatMap((record) =>
      record.prescriptions.map((p) => ({
        ...p,
        recordId: record._id,
        provider: record.providerId,
        appointment: record.appointmentId,
        diagnosis: record.diagnosis,
        appointmentDate: record.appointmentId?.date,
      }))
    );

    prescriptions.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ success: true, data: prescriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// get lab orders by client for provider
exports.getLabOrdersByClientForProvider = async (req, res) => {
  try {
    const { clientId } = req.params;
    const records = await MedicalHistoryRecord.find({ clientId,providerId:req.user.id })
      .populate("providerId appointmentId", "name date")
      .sort({createdAt:-1})
      .lean();
    const labs = records.flatMap((record) =>
      record.lapOrders.map((l) => ({
        ...l,
        provider: record.providerId,
        appointmentDate: record.appointmentId?.date,
        appointment: record.appointmentId,
        recordId: record._id,
      }))
    );
    res.status(200).json({ success: true, data: labs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }};


 


exports.getLastVitals = async (req, res) => {
  try {
    const  clientId  = req.user.id;

    // Find the latest medical history record for this client
    const lastRecord = await MedicalHistoryRecord.findOne({ clientId })
      .sort({ createdAt: -1 }) // newest first
      .select("vitals createdAt appointmentId providerId"); // pick only what you need

    if (!lastRecord) {
      return res.status(404).json({ message: "No vitals found for this client" });
    }

    res.status(200).json({
 
      lastVitals: lastRecord.vitals,
      recordedAt: lastRecord.createdAt,
      appointmentId: lastRecord.appointmentId,
      providerId: lastRecord.providerId,
    });
  } catch (error) {
    console.error("Error fetching last vitals:", error);
    res.status(500).json({ message: "Server error"});
  }
};

