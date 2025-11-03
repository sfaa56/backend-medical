// models/Clinc.js
const mongoose = require("mongoose");

const ClincSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  postalCode: { type: mongoose.Schema.Types.ObjectId, ref: "PostalCode" },
  timeFrom: { type: String, required: true, default: "08:00" },
  timeTo: { type: String, required: true, default: "08:00" },
  day: {
    type: [String],
    enum: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    required: true,
  },
  clinicPhoto: { publicId: { type: String }, url: { type: String } },
});

module.exports = mongoose.model("Clinc", ClincSchema);
