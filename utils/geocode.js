const axios = require("axios");

/**
 * Convert city + district + postalCode into latitude/longitude
 * using OpenStreetMap's Nominatim API
 */
exports.geocodeAddress = async (city, district, postalCode) => {
  try {
    if (!city && !district && !postalCode) return null;

    const query = [district, city, postalCode].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1`;

    const res = await axios.get(url, {
      headers: { "User-Agent": "CareLinkApp" },
    });

    if (res.data.length === 0) return null;

    const { lat, lon } = res.data[0];
    return {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
    };
  } catch (err) {
    console.error("❌ Geocode error:", err.message);
    return null;
  }
};
