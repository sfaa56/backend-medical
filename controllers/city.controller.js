const City = require("../models/City");
const joi = require("joi");
const User = require("../models/User");
const District = require("../models/District");
const PostalCode = require("../models/PostalCode");

// Validation schema
const citySchema = joi.object({
  name: joi.string().required(),
  active: joi.boolean().default(false),
  districts: joi
    .array()
    .items(
      joi.object({
        name: joi.string().required(),
        active: joi.boolean().default(true),
        postalCodes: joi.array().items(
          joi.object({
            code: joi.string().required(),
            active: joi.boolean().default(true),
          })
        ),
      })
    )
    .default([]),
});

exports.createCity = async (req, res) => {
  console.log("Creating city", req.body);
  // Validate the request body
  const { error } = citySchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "You are not authorized to create a city" });
  }

  try {
    // Check if the city already exists
    const existingCity = await City.findOne({ name: req.body.name });
    if (existingCity) {
      return res.status(400).json({ error: "City already exists" });
    }

    // Create the new city
    req.body.active = req.body.active || false; // Default to false if not provided
    req.body.districts = req.body.districts || []; // Default to empty array if not provided

    const city = await City.create({
      name: req.body.name,
      active: req.body.active,
    });

    // Add districts if provided
    if (req.body.districts && req.body.districts.length > 0) {
      for (const district of req.body.districts) {
        const created_district = await District.create({
          name: district.name,
          active: district.active || false, // Default to true if not provided
          city: city._id,
        });

        // Add postal codes
        for (const code of district.postalCodes) {
          console.log("Adding postal code", code);
          await PostalCode.create({
            code: code.code,
            active: code.active || false, // Default to true if not provided
            district: created_district._id, // Assuming district._id is available
          });
        }
      }
    }

    // Populate the districts and postal codes
    await city.populate({
      path: "districts",
      populate: { path: "postalCodes" },
    });

    console.log("City created successfully", city);

    res.status(201).json(city);
  } catch (error) {
    console.error("Error creating city:", error);
    res.status(500).json({ error: "something went wrong" });
  }
};

exports.getAllCities = async (req, res) => {
  try {
    cities = await City.find().populate({
      path: "districts",
      populate: { path: "postalCodes" },
    });

    console.log("cities", cities);
    res.status(200).json(cities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCity = async (req, res) => {
  console.log("updateing city", req.params.cityId);
  console.log("updateing city body", req.body);

  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "You are not authorized to update a city" });
  }

  const { cityId } = req.params;
  const { name, active, districts = [] } = req.body;

  try {
    const city = await City.findByIdAndUpdate(
      cityId,
      { name, active },
      {
        new: true,
      }
    );
    if (!city) {
      return res.status(404).json({ error: "City not found" });
    }

    const existingDistricts = await District.find({ city: cityId });
    const existingDistrictIds = existingDistricts.map((d) => d._id.toString());

    // track districts to keep
    const districtsToKeep = [];

    for (const districtData of districts) {

      if (districtData._id) {
        // udpate existing district
        const district = await District.findByIdAndUpdate(
          { _id: districtData.id, city: city._id },
          {
            name: districtData.name,
            active: districtData.active || false,
          },
          { new: true }
        );

        if (!district) continue;
        districtsToKeep.push(district._id);

        // update postal codes
        const existingPostalCodes = await PostalCode.find({
          district: district._id,})
        const existingPostalCodeIds = existingPostalCodes.map(
          (p) => p._id.toString())
        const postalsToKeep = [];

        for (const postalData of districtData.postalCodes || []) {
          if (postalData._id) {
            // update existing postal code
            const postal = await PostalCode.findByIdAndUpdate(
              { _id: postalData._id, district: district._id },{
              code: postalData.code,
              active: postalData.active,
              })

              if(postal) {
                postalsToKeep.push(postal._id);
              }
            
          }else{
            // create new postal code
            const postal = await PostalCode.create({
              code: postalData.code,
              active: postalData.active || false,
              district: district._id,
            });
            postalsToKeep.push(postal._id);
          }
        }
  
        const deletePostalIds = existingPostalCodeIds.filter(
          (id)=> !postalsToKeep.map((x)=>x.toString()).includes(id)
          )

          await PostalCode.deleteMany({
            _id: { $in: deletePostalIds },
          });

      } else {
        // create new district
        const district = await District.create({
          name: districtData.name,
          active: districtData.active || false,
          city: city._id,
        });

        districtsToKeep.push(district._id);

        // create postal codes
        for (const postalData of districtData.postalCodes || []) {
          await PostalCode.create({
            code: postalData.code,
            active: postalData.active || false,
            district: district._id,
          });
        }

      }
    }

    // delete districts that are not in the request
    const deleteDistrictIds = existingDistrictIds.filter(
      (id) => !districtsToKeep.map((x) => x.toString()).includes(id)
    );
    await PostalCode.deleteMany({ district: { $in: deleteDistrictIds } }); 
    await District.deleteMany({ _id: { $in: deleteDistrictIds } });

   res.status(200).json({ message: "City and nested data updated" });
  } catch (error) {
    console.error("Error updating city:", error);
    res.status(400).json({ error: "something went wrong" });
  }
};

exports.deleteCity = async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "You are not authorized to delete a city" });
  }
  const city = req.params.cityId;
  try {
    const userUsingCity = await User.findOne({ city });

    if (userUsingCity) {
      return res.status(400).json({ message: "City is in use by a user" });
    }

    // check if districts exist for the city
    const districts = await District.find({ city: req.params.cityId });
    if (districts.length > 0) {
      return res.status(400).json({
        message: "City cannot be deleted because it has associated districts",
      });
    }

    const deletedCity = await City.findByIdAndDelete(req.params.cityId);
    if (!deletedCity) {
      return res.status(404).json({ error: "City not found" });
    }

    res.status(200).json({ message: "City deleted" });
  } catch (error) {
    console.error("Error deleting city:", error);
    res.status(500).json({ error: "something went wrong" });
  }
};
