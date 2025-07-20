// controllers/providerServiceController.js
const ProviderService = require('../models/ProviderService');
const joi = require('joi');

// Validation schema
const providerServiceSchema = joi.object({
  title: joi.string().required(),
  description: joi.string().optional(),
  price: joi.number().required(),
  serviceCategory: joi.string().required(),
  specialtyId: joi.string().optional()
});

exports.createProviderService = async (req, res) => {

  // Validate the request body
  const { error } = providerServiceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { specialtyId, serviceCategory, title, description, price } = req.body;
    const { providerId } = req.user.id; 

    const service = new ProviderService({
      providerId,
      serviceCategory,
      title,
      description,
      price,
      specialtyId
   
    });
    await service.save();
    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getServicesByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const services = await ProviderService.find({ provider: providerId }).populate('serviceCategory');
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
