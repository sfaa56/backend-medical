const cloudinary = require("cloudinary").v2;

// Configure Cloudinary with your Cloud name, API Key, and API Secret
cloudinary.config({ 
    cloud_name: 'dxhgmrvi0', 
    api_key: process.env.CLOUDINARY_API_KEY , 
    api_secret:  process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary; 
