const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    complaintNumber: {
      type: String,
      default: () => Date.now().toString(), // auto-generate if needed
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // can be null until assigned
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceRequest" },

    type: {
      type: String,
      enum: ["Complaint", "Inquiry", "Suggestion"],
      default: "Complaint",
    },

    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved", "Rejected"],
      default: "Pending",
    },

    date: {
      type: Date,
      default: Date.now,
    },

    content: { type: String, required: true },

    officialResponse: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
