const mongoose = require("mongoose");

const experienceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    jobTitle: { type: String, required: true },
    hospital: { type: String, required: true },
    startYear: { type: Number, required: true },
    endYear: { type: Number },
    currentlyWorking: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Experience", experienceSchema);