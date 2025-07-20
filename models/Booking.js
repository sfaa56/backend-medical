
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  providerServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProviderService', required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },


  scheduledAt: { type: Date }, // وقت التنفيذ المحدد
  completedAt: { type: Date }, // وقت انتهاء الخدمة
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);