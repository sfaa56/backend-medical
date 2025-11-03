const mongoose = require("mongoose");

const medicalHistorySchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    required: true,
  },
  vitals: {
    temperature: String,
    pulse: String,
    height: String,
    weight: String,
  },
  diagnosis: [{ type: String }],
  prescriptions: [
    {
      medicationName: String,
      dosage: String,
      duration: String,
      instruction: String,
      createdFrom: {
        type: String,
        enum: ["appointment", "post"],
        default: "appointment",
      },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  lapOrders: [
    {
      name: String,
      files: [{ publicId: String, url: String }],

      createdFrom: {
        type: String,
        enum: ["appointment", "post"],
        default: "appointment",
      },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  advice: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("MedicalHistory", medicalHistorySchema);
