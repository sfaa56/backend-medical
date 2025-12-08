const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: [    
        "booking_updated",
        "booking_cancelled",
        "booking_created",
        "booking_accepted",
        "booking_rejected",

        "appointment_created",
        "appointment_cancelled",
        "appointment_completed",
        "appointment_started",
        "followup_booked",

        "offer_received",
        "offer_accepted",
        "offer_rejected",
        "offer_withdrawn",
        
        "new_review",
        "review_request",

        "provider_registeration",

        "complaint",

        "message"


      ],
      required: true
    },
    message: { type: String, required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId }, // bookingId, appointmentId, etc
    data: { type: Object }, // optional extra payload
    seen: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
