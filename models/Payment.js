const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },
  method: {
    type: String,
    enum: ['credit_card', 'paypal', 'cash', 'bank_transfer'],
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  },
  transactionId: { type: String }
});

module.exports = mongoose.model('Payment', paymentSchema);
