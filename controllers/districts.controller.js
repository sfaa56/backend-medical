const City = require("../models/City");
const District = require("../models/District");
const PostalCode = require("../models/PostalCode");

exports.addDistrict = async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "You are not authorized to create a city" });
  }

  const { cityId } = req.params;
  const { name, active, postalCodes = [] } = req.body;

  try {
    const city = await City.findById(cityId);

    if (!city) return res.status(404).json({ error: "City not found" });

    const newDistrict = await District.create({ name, active, city: cityId });

    if (postalCodes.length > 0) {
      for (const postalCode of postalCodes) {
        console.log("postalCode", postalCode);
        const newPostalCode = await PostalCode.create({
          ...postalCode,
          district: newDistrict._id,
        });
      }
    }

    await newDistrict.populate({
      path: "postalCodes",
    });

    res.status(201).json(newDistrict);
  } catch (error) {
    console.log("erorr", error);
    res.status(400).json({ error: "something went wrong" });
  }
};
exports.updateDistrict = async (req, res) => {
  const { cityId, districtId } = req.params;
  const { name, active, postalCodes = [] } = req.body;
  try {
    const city = await City.findById(cityId);
    if (!city) return res.status(404).json({ error: "City not found" });

    const district = await District.findByIdAndUpdate(districtId, {
      name,
      active,
    });

    console.log("here")

    if (!district) return res.status(404).json({ error: "District not found" });

    const existingPostalCodes = await PostalCode.find({ district: districtId });
    const existingPostalCodeIds = existingPostalCodes.map((pc) =>
      pc._id.toString()
    );

    console.log("here")


    // track postal codes to keep
    const postalCodesToKeep = new Set();

    // track postal codes to delete
    const postalCodesToDelete = new Set();

    console.log("here")


    // Update or create postal codes
    for (const postalCode of postalCodes) {
      if (postalCode._id) {
        // Update existing postal code

        postalCodesToKeep.add(postalCode._id.toString());
      } else {
        // Create new postal code
        const newPostalCode = await PostalCode.create({
          code: postalCode.code,
          active: postalCode.active || false,
          district: district._id,
        });
        postalCodesToKeep.add(newPostalCode._id.toString());
      }
    }
    // Identify postal codes to delete
    for (const existingPostalCode of existingPostalCodes) {
      if (!postalCodesToKeep.has(existingPostalCode._id.toString())) {
        postalCodesToDelete.add(existingPostalCode._id.toString());
      }
    }

    // Delete postal codes that are not in the updated list
    for (const postalCodeId of postalCodesToDelete) {
      await PostalCode.findByIdAndDelete(postalCodeId);
    }

    console.log("district", district);

    await city.save();
    res.status(201).json(city);
  } catch (error) {
    console.log("erorr", error);
    res.status(500).json({ error: "something went wrong" });
  }
};
exports.deleteDistrict = async (req, res) => {
  const { cityId, districtId } = req.params;
  const city = await City.findById(cityId);
  if (!city) return res.status(404).json({ error: "City not found" });
  try {
    // Check if district exists
    const district = await District.findById(districtId);
    if (!district) return res.status(404).json({ error: "District not found" });
    // check if district is used by postal codes
    const postalCodes = await PostalCode.find({ district: districtId });

    if (postalCodes.length > 0) {
      return res.status(400).json({
        error: "District cannot be deleted because it has associated postal codes",
      });
    }
    
    // Delete the district
    await District.findByIdAndDelete(districtId);


    res.status(200).json({ message: "District deleted" });
  } catch (error) {
    console.log("erorr", error);
    res.status(500).json({ error: "something went wrong" });
  }
};
