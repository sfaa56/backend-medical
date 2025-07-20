// models/Offer.js
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  price: { type: Number, required: true },
  estimatedTime: { type: String }, // مثال: "2 ساعات"
  message: { type: String },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Offer', offerSchema);


 
