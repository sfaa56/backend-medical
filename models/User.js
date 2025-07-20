// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["client", "provider", "admin"],
      default: "client",
    },
    isActive: { type: Boolean, default: true },

    isVerified: {
      type: Boolean,
      default: function () {
        return this.role === "provider" ? false : true;
      },
    },
    isBanned: { type: Boolean, default: false },

    phoneNumber: { type: String, required: true },

    refreshToken: {
      type: String,
      required: false,
    },
    postalCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostalCodeSchema",
    },
    SubSpecialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubSpecialty",
    },
    image: {
      publicId: { type: String },
      url: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
