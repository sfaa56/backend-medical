const Invoice = require('../models/Invoice');

exports.createInvoice = async (req, res) => {
  try {
    const invoice = new Invoice(req.body);
    const saved = await invoice.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('bookingId clientId providerId');
    res.status(200).json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('bookingId clientId providerId');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.status(200).json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const updated = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInvoicesByClientId = async (req, res) => {
  try {
    const invoices = await Invoice.find({ clientId: req.params.clientId }).populate('bookingId clientId providerId');
    res.status(200).json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
