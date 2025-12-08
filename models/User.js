// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    about: { type: String, defualt: "" },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gender: { type: String, required: true },
    role: {
      type: String,
      enum: ["client", "provider", "admin"],
      default: "client",
    },
    dateOfBirth: {
      day: { type: Number },
      month: { type: String },
      year: { type: Number },
    },
    isActive: { type: Boolean, default: true },

    isVerified: {
      type: Boolean,
      default: function () {
        return this.role === "provider" ? false : true;
      },
    },
    isBanned: { type: Boolean, default: false },

    phone: { type: String, required: true },

    refreshToken: {
      type: String,
      required: false,
    },
    postalCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostalCode",
    },
    subspecialty: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubSpecialty",
      },
    ],
    experienceYears: { type: Number, default: 0 },
    licenseNumber: { type: String, default: "" },
    licenseFile: { publicId: { type: String }, url: { type: String } },

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

    availability: {
      type: Map,
      of: new mongoose.Schema(
        {
          from: { type: String, required: true },
          to: { type: String, required: true },
        },
        { _id: false }
      ),
    },

    image: {
      publicId: { type: String },
      url: { type: String },
    },

    services: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ProviderService" },
    ],

    clinics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clinc" }],

    experiences: [{ type: mongoose.Schema.Types.ObjectId, ref: "Experience" }],
    qualifications: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Qualification" },
    ],

    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    isAvailable: { type: Boolean, default: true },

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

  // password reset fields
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },
  // used to invalidate tokens issued before password change
  passwordChangedAt: { type: Date }

  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });



// Instance method: create reset token (returns raw token)
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  // store hashed token
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + (10 * 60 * 1000); // 10 minutes
  return resetToken;
};


module.exports = mongoose.model("User", userSchema);
