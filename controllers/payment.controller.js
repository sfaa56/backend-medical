const Payment = require('../models/Payment');

exports.createPayment = async (req, res) => {
  try {
    const payment = new Payment(req.body);
    const saved = await payment.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate('invoiceId clientId providerId');
    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('invoiceId clientId providerId');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const updated = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Payment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
