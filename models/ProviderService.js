// models/ProviderService.js
const mongoose = require("mongoose");

const providerServiceSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: { type: String, required: true },

    place: { type: String, required: true },

    price: { type: Number, required: true },

    priceType: {
      type: String,
      enum: ["Hourly", "Session"],
      default: "Session",
    },

    cuncurncey: {
      type: String,
      enum: ["USD", "EGP", "EUR"],
    },

    serviceCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
    },

    subServiceCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubServiceCategory",
    },

    specialty: { type: mongoose.Schema.Types.ObjectId, ref: "Specialty" },

    image: {
      publicId: { type: String },
      url: { type: String },
    },

    bookings: [
      {
        bookingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ServiceBookingRequest",
        },
        clientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
          default: "pending",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lon, lat]
        default: [0, 0],
      },
    },
  },
  { timestamps: true }
);

providerServiceSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("ProviderService", providerServiceSchema);
