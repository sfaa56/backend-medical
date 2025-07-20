// models/ProviderService.js
const mongoose = require('mongoose');

const providerServiceSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  title: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  serviceCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory', required: true },
  specialtyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty' }
}, { timestamps: true });

module.exports = mongoose.model('ProviderService', providerServiceSchema);