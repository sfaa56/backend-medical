const Review = require('../models/Review');
const joi = require('joi');
const reviewSchema = joi.object({
  bookingId: joi.string().optional(),
  ServiceRequestId: joi.string().optional(),
  clientId: joi.string().required(),
  providerId: joi.string().required(),
  rating: joi.number().min(1).max(5).required(),
  comment: joi.string().optional(),
});


exports.createReview = async (req, res) => {
  // Validate the request body
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  try {
    const review = new Review(req.body);
    const saved = await review.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find().populate('bookingId clientId providerId');
    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate('bookingId clientId providerId');
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.status(200).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const updated = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
