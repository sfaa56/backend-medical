const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { geocodeAddress } = require("./utils/geocode");
const Request = require("./models/ServiceRequest");
const connectDb = require("./config/dbConnection");

// ✅ must import all referenced models so Mongoose registers them
const PostalCode = require("./models/PostalCode");
const District = require("./models/District");
const City = require("./models/City");

dotenv.config();

(async () => {
  try {
    await connectDb();
    console.log("✅ Connected to MongoDB");

    const providers = await Request.find({
      $or: [
        { "location.coordinates": [0, 0] },
        { "location.coordinates": { $exists: false } },
      ],
    })
      .populate({
        path: "postalCode",
        populate: {
          path: "district",
          populate: { path: "city" },
        },
      });

    console.log(`🩺 Found ${providers.length} providers to geocode...\n`);

    let success = 0,
      skipped = 0;

    for (const p of providers) {
      const postal = p.postalCode;
      const district = postal?.district;
      const city = district?.city;

      const postalCodeValue = postal?.code;
      const districtName = district?.name;
      const cityName = city?.name;

      if (!cityName && !districtName && !postalCodeValue) {
        console.log(`⚠️ Skipping ${p.firstName} ${p.lastName} (no location data)`);
        skipped++;
        continue;
      }

      console.log(`🔍 Geocoding: ${districtName || ""}, ${cityName || ""}, ${postalCodeValue || ""}`);
      const coords = await geocodeAddress(cityName, districtName, postalCodeValue);

      if (coords) {
        p.location = { type: "Point", coordinates: [coords.lon, coords.lat] };
        await p.save();
        console.log(`✅ Updated ${p.firstName} ${p.lastName} (${cityName || ""}, ${districtName || ""})`);
        success++;
      } else {
        console.log(`❌ Failed to geocode ${p.firstName} ${p.lastName} (${cityName || ""}, ${districtName || ""}, ${postalCodeValue || ""})`);
        skipped++;
      }
    }

    console.log(`\n🎉 Done! Updated ${success} providers, skipped ${skipped}.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Script error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
})();
