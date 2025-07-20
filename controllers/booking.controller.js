const Booking = require("../models/Booking");
const joi = require("joi");
const Review = require("../models/Review");

const bookingSchema = joi.object({
  clientId: joi.string().required(),
  providerId: joi.string().required(),
  providerServiceId: joi.string().required(),
  status: joi
    .string()
    .valid("pending", "in_progress", "completed", "cancelled")
    .default("pending"),
  scheduledAt: joi.date().optional(),
  completedAt: joi.date().optional(),
  notes: joi.string().optional(),
});

exports.createBooking = async (req, res) => {
  // Validate the request body
  const { error } = bookingSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const booking = new Booking(req.body);
    const savedBooking = await booking.save();
    res.status(201).json(savedBooking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate(
      "serviceRequestId clientId providerId offerId"
    );
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      "serviceRequestId clientId providerId offerId"
    );
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.status(200).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBooking = async (req, res) => {
  // Check if the booking exists
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (
    booking.clientId.toString() !== req.user._id.toString() ||
    booking.providerId.toString() !== req.user._id.toString()
  ) {
    return res
      .status(403)
      .json({ message: "You are not authorized to update this booking" });
  }

  try {
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json(updatedBooking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteBooking = async (req, res) => {
  // Check if the booking exists
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (
    booking.clientId.toString() !== req.user._id.toString() ||
    booking.providerId.toString() !== req.user._id.toString()
  ) {
    return res
      .status(403)
      .json({ message: "You are not authorized to delete this booking" });
  }

  const review = await Review.findOne({ bookingId: req.params.id });

  if (review) {
    await review.deleteOne();
  }

  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
