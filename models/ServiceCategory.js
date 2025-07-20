const mongoose = require('mongoose');

// models/ServiceCategory.js
const serviceCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialty: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true },
  description: String
});

module.exports = mongoose.model('ServiceCategory', serviceCategorySchema);
