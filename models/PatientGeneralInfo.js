const mongoose = require("mongoose");

const patientGeneralInfoSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  chronicConditions: [String],
  pastSurgeries: [
    {
      name: String,
      year: String,
      hospital: String
    }
  ],
  allergies: [
    {
      name: String,
      severity: String
    }
  ],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PatientGeneralInfo", patientGeneralInfoSchema);