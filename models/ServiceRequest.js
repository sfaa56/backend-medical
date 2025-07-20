// models/ServiceRequest.js
const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  specialtyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  city:{type:mongoose.Schema.Types.ObjectId, ref: 'City'},
  status: {
    type: String,
    enum: ['pending', 'offers_received', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  attachments: [{
    public_id: { type: String, required: true }, // Cloudinary public ID
    url: { type: String, required: true } // Cloudinary URL
  }], 
}, { timestamps: true });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
