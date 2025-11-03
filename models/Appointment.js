const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({

   // ✅  for offer flow
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Offer",

  },
  serviceRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceRequest",
  },


  // ✅  for booking flow
  serviceBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceBookingRequest",
  },
  serviceId: 
  { type: mongoose.Schema.Types.ObjectId, ref: "ProviderService"},



  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time:{
    type:String,

  },
  place: {
    type: String,
    required: true,
  },
  address: String,
  status: {
    type: String,
    enum: ["upcoming", "started", "completed", "cancelled"],
    default: "upcoming",
  },
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
  },
  subSpecialtyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubSpecialty",
  },

  followUpOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
  },

  // 🔹 تفاصيل الجلسة (يملأها الدكتور بعد Start)
  sessionDetails: {
    vitals: {
      temperature: { type: String },
      pulse: { type: String },
      height: { type: String },
      weight: { type: String },
    },
    generalExam: {
      appearance: { type: String },
      consciousness: { type: String },
      hydration: { type: String },
      notes: { type: String },
    },
    diagnosis: [{ type: String }],
    LapOrders: [
      {
        name: { type: String },
        publicId: { type: String },
        url: { type: String },
      },
    ],
    orders: [
      {
        medicationName: { type: String },
        dosage: { type: String },
        duration: { type: String },
        instruction: { type: String },
      },
    ],

    advice: { type: String },
  },

  followUpBooked: {
    type: Boolean,
    default: false,
  },
  
    reviewed: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Appointment", appointmentSchema);
