const mongoose = require("mongoose");

const subServiceCategorySchema = new mongoose.Schema({
  name: { type: String },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceCategory",
    required: true,
  },
});

module.exports = mongoose.model("SubServiceCategory", subServiceCategorySchema);
