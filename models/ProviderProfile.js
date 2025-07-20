
const mongoose = require('mongoose');

const providerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bio: { type: String },
  rating: { type: Number, default: 0 },
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProviderService' }]
}, { timestamps: true });

module.exports = mongoose.model('ProviderProfile', providerProfileSchema);

