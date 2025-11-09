const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: { type: String, required: true },
    description: { type: String },

    subSpecialty: { type: mongoose.Schema.Types.ObjectId, ref: "SubSpecialty" },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubServiceCategory",
    },

    preferredTime: {
      from: { type: String },
      to: { type: String },
    },

    requirements: [{ type: String }],

    postalCode: { type: mongoose.Schema.Types.ObjectId, ref: "PostalCode" },

    patientDetails: {
      name: { type: String },
      age: { type: String },
      gender: { type: String, enum: ["Male", "Female"] },
      medicalHistory: { type: String },
    },

    status: {
      type: String,
      enum: [
        "pending",
        "offers_received",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },

    attachments: [
      {
         _id: false,
        name: { type: String },
        publicId: { type: String },
        url: { type: String },
      },
    ],

    price: { type: String },
    priceType: {
      type: String,
      enum: ["Hourly", "Session", "Visit"],
      default: "Session",
    },
    currency: {
      type: String,
      enum: ["USD", "EGP", "EUR"],
    },

    offers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Offer" }],

    acceptedOffer: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
    acceptedProvider: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    place: { type: String, required: true },

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

serviceRequestSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
