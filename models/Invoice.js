const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  amount: { type: Number, required: true },
  issuedAt: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ['unpaid', 'paid', 'overdue'],
    default: 'unpaid'
  },
  notes: { type: String }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
