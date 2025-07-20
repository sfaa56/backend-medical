const Region = require("../models/District");
const User = require("../models/User");

exports.createRegion = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const region = await Region.create(req.body);
    res.status(201).json(region);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllRegions = async (req, res) => {
  try {
    const regions = await Region.find();
    res.status(200).json(regions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateRegion = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const region = await Region.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json(region);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteRegion = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  const region = req.params.id;
  try {
    const providerUsingRegion = await User.findOne({ region });
    const cityUsingRegion = await City.findOne({ region });
    if (cityUsingRegion) {
      return res.status(400).json({ message: "Region is in use by a city" });
    }

    if (providerUsingRegion) {
      return res
        .status(400)
        .json({ message: "Region is in use by a provider" });
    }

    await Region.findByIdAndDelete(region);
    res.status(200).json({ message: "Region deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
