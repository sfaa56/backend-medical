const mongoose = require('mongoose');
const DistrictSchema = require("./District")

const CitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  active: { type: Boolean, default: false },
});

// Virtual: list of districts belonging to this city
CitySchema.virtual('districts', {
  ref: 'District',
  localField: '_id',
  foreignField: 'city',
});

CitySchema.set('toObject', { virtuals: true });
CitySchema.set('toJSON', { virtuals: true });


module.exports = mongoose.model('City', CitySchema);
