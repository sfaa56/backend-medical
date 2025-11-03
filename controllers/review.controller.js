const Review = require("../models/Review");
const joi = require("joi");
const reviewSchema = joi.object({
  bookingId: joi.string().optional(),
  ServiceRequestId: joi.string().optional(),
  clientId: joi.string().required(),
  providerId: joi.string().required(),
  rating: joi.number().min(1).max(5).required(),
  comment: joi.string().optional(),
});

const Appointment = require("../models/Appointment");
const { sendNotification } = require("../utils/notify");
const User = require("../models/User");
const mongoose = require("mongoose");

exports.createReview = async (req, res) => {
  try {
    const { id } = req.params; // appointmentId

    const { rating, comment } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // ✅ Only the client of this appointment can review it
    if (appointment.clientId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to review this appointment" });
    }

    // ✅ Only allow after completion
    if (appointment.status !== "completed") {
      return res
        .status(400)
        .json({ message: "Cannot review before appointment is completed" });
    }

    // ✅ Prevent duplicate review
    const existing = await Review.findOne({ appointmentId: id });
    if (existing) {
      return res
        .status(400)
        .json({ message: "You already reviewed this appointment" });
    }

    // ✅ Create review
    const review = await Review.create({
      appointmentId: id,
      providerId: appointment.providerId,
      clientId: req.user.id,
      rating,
      comment,
    });

    // ✅ Mark appointment as reviewed
    appointment.reviewed = true;
    await appointment.save();

    const stats = await Review.aggregate([
      { $match: { providerId: appointment.providerId } },
      { $group: { _id: "$providerId", avgRating: { $avg: "$rating" } } },
    ]);

    const summary = stats[0] || { avgRating: 0, totalReviews: 0 };

    await User.findByIdAndUpdate(appointment.providerId, {
      averageRating: summary.avgRating.toFixed(1),
      totalReviews: summary.totalReviews,
    });

    // ✅ Notify provider
    await sendNotification({
      recipientId: appointment.providerId,
      senderId: req.user.id,
      type: "new_review",
      message: `You received a ${rating}-star review from a patient.`,
      relatedId: review._id,
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    console.error("❌ createReview error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ Get all reviews for a provider
exports.getProviderReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ providerId: req.params.id })
      .populate("clientId", "firstName image")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ Calculate provider average rating
exports.getProviderRatingSummary = async (req, res) => {
  try {
    const stats = await Review.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(req.params.id) } },
      {
        $group: {
          _id: "$providerId",
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const summary = stats[0] || { avgRating: 0, totalReviews: 0 };
    res.status(200).json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find().populate(
      "bookingId clientId providerId"
    );
    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate(
      "bookingId clientId providerId"
    );
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.status(200).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const updated = await Review.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getProviderReviewStats = async (req, res) => {
  try {
    const providerId = req.params.id;

    // ✅ Aggregate ratings
    const stats = await Review.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(providerId) } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    // ✅ Calculate totals
    const totalReviews = stats.reduce((acc, s) => acc + s.count, 0);
    let weightedSum = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    stats.forEach((s) => {
      distribution[s._id] = s.count;
      weightedSum += s._id * s.count;
    });

    const avgRating = totalReviews > 0 ? (weightedSum / totalReviews).toFixed(1) : 0;

    // ✅ Get all reviews for list view
    const reviews = await Review.find({ providerId })
      .populate("clientId", "firstName lastName image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        avgRating: Number(avgRating),
        totalReviews,
        distribution,
        reviews,
      },
    });
  } catch (err) {
    console.error("❌ getProviderReviewStats error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};
