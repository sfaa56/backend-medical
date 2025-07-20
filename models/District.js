const mongoose = require('mongoose');
const PostalCodeSchema = require('./PostalCode');  

const DistrictSchema = new mongoose.Schema({
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
  city: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
});

// Virtual: list of postal codes under this district
DistrictSchema.virtual('postalCodes', {
  ref: 'PostalCode',
  localField: '_id',
  foreignField: 'district',
});

DistrictSchema.set('toObject', { virtuals: true });
DistrictSchema.set('toJSON', { virtuals: true });


module.exports = mongoose.model('District',DistrictSchema);     

