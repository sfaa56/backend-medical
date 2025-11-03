// models/Qualification.js
const mongoose = require("mongoose");

const qualificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true, // e.g. "MBBS", "PhD in Cardiology"
    },
    institution: {
      type: String,
      required: true, // e.g. "Cairo University"
    },
    dateObtained: {
      type: Date,
      required: true,
    },
    image: { publicId: { type: String }, url: { type: String } },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Qualification", qualificationSchema);
