const ProviderProfile = require('../models/ProviderProfile');
const User = require('../models/User');

// Create or update provider profile
exports.createOrUpdateProfile = async (req, res) => {
  try {
    const { bio, serviceIds } = req.body;
    const userId = req.user._id; // Assuming authentication middleware sets req.user

    // Check if user is a provider
    const user = await User.findById(userId);
    if (!user || user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can create profiles.' });
    }

    const profile = await ProviderProfile.findOneAndUpdate(
      { userId },
      { bio, serviceIds },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Error creating profile', error: error.message });
  }
};

// Get provider profile by user ID
exports.getProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await ProviderProfile.findOne({ userId }).populate('serviceIds');

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};
