const mongoose = require("mongoose");

const ServiceBookingRequestSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderService", required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },


  // Booking time
  date: { type: Date, required: true },
  time: { type: String, required: true },

  // Address info
  city: String,
  address: String,
  place: { type: String, default: false },

  // Notes
  notes: String,

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected','completed','cancelled'],
    default: "pending",
  }
}, { timestamps: true });

module.exports = mongoose.model("ServiceBookingRequest", ServiceBookingRequestSchema);