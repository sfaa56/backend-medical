const City = require("../models/City");
const PostalCode = require("../models/PostalCode");

exports.addPostalCode = async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "You are not authorized to create a postal code" });
  }

  try {
    const { cityId, districtId } = req.params;
    const { code, active } = req.body;

    const city = await City.findById(cityId);
    if (!city) return res.status(404).json({ error: "City not found" });

    const newPostalCode = await PostalCode.create({
      code,
      active,
      district: districtId,
    });

    res.status(201).json(newPostalCode);
  } catch (error) {
    console.error("Error adding postal code:", error);
    res.status(500).json("something went wrong");
  }
};

exports.updatePostalCode = async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "You are not authorized to update a postal code" });
  }

  try {
    const { cityId, districtId, postalId } = req.params;
    const { code, active } = req.body;

    const city = await City.findById(cityId);
    if (!city) return res.status(404).json({ error: "City not found" });

    await PostalCode.findByIdAndUpdate({ _id: postalId }, { code, active });
    await city.save();
    res.status(200).json(city);
  } catch (error) {
    console.error("Error updating postal code:", error);
    res.status(500).json("something went wrong");
  }
};

exports.deletePostalCode = async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "You are not authorized to delete a postal code" });
  }

  try {
    const { cityId, districtId, postalId } = req.params;
    const city = await City.findById(cityId);
    if (!city) return res.status(404).json({ error: "City not found" });
   const deletedPostalCode = await PostalCode.findByIdAndDelete(postalId);
    if (!deletedPostalCode) {
      return res.status(404).json({ error: "Postal code not found" });
    }
    
    await city.save();

    res.status(200).json(city);
  } catch (error) {
    console.error("Error deleting postal code:", error);
    res.status(500).json("something went wrong");
  }
};
