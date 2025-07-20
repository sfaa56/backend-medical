const Offer = require('../models/Offer');

const joi = require('joi');

const offerSchema = joi.object({
  serviceRequestId: joi.string().required(),
  providerId: joi.string().required(),
  price: joi.number().required(),
  estimatedTime: joi.string(),
  message: joi.string(),
  status: joi.string().valid('pending', 'accepted', 'rejected').default('pending'),
});

exports.createOffer = async (req, res) => {
  
  // Validate request body
  const { error } = offerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  req.body.providerId = req.user._id; 

  try {
    const offer = new Offer(req.body);
    const savedOffer = await offer.save();
    res.status(201).json(savedOffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find().populate('serviceRequestId providerId');
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate('serviceRequestId providerId');
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    res.status(200).json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedOffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteOffer = async (req, res) => {

  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ message: 'Offer not found' });
  
  if (!req.user.isAdmin|| offer.providerId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You are not authorized to delete this offer' });
  }

  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Offer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getOffersByProvider = async (req, res) => {
  try {
    const offers = await Offer.find({ providerId: req.params.providerId }).populate('serviceRequestId providerId');
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getOffersByServiceRequest = async (req, res) => {
  try {
    const offers = await Offer.find({ serviceRequestId: req.params.serviceRequestId }).populate('serviceRequestId providerId');
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getOffersByClient = async (req, res) => {
  try {
    const offers = await Offer.find({ clientId: req.params.clientId }).populate('serviceRequestId providerId');
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


