const ServiceRequest = require("../models/ServiceRequest");
const Joi = require("joi");
const cloudinary = require("../config/cloudinary");
const Review = require("../models/Review");

const serviceRequestSchema = Joi.object({
  clientId: Joi.string().required(),
  categoryId: Joi.string().required(),
  title: Joi.string().min(4).required(),
  description: Joi.string().min(10).required(),
  specialityId: Joi.string().required(),
  city: Joi.string().required(),
});

exports.createRequest = async (req, res) => {
  const { error } = serviceRequestSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  if (req.user.role !== "client") {
    return res.status(403).json({ message: "Access denied" });
  }

  req.body.clientId = req.user.id;

  try {
    const request = new ServiceRequest(req.body);
    const saved = await request.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find().populate(
      "clientId categoryId subcategoryId regionId"
    );
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRequestById = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id).populate(
      "clientId categoryId subcategoryId regionId"
    );
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.status(200).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRequest = async (req, res) => {
  const { error } = serviceRequestSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  if (req.user.role !== "client" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const updated = await ServiceRequest.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRequest = async (req, res) => {
  if (req.user.role !== "client" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const review = await Review.find({ serviceRequestId: req.params.id });

    if (review) {
      await review.deleteOne();
    }

    if (request.attachments && request.attachments.length > 0) {
      for (const attachment of request.attachments) {
        await cloudinary.uploader.destroy(attachment.public_id);
      }
    }

    await ServiceRequest.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRequestsByClientId = async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      clientId: req.params.clientId,
    }).populate("clientId categoryId subcategoryId regionId");
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
