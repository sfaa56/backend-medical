const express = require('express');
const router = express.Router();
const validateToken = require('../middleware/validateToken');
const providerProfileController = require('../controllers/providerProfile.controller');


router.post ('/',validateToken,providerProfileController.createOrUpdateProfile);
router.get('/:userId',providerProfileController.getProfileByUserId);

module.exports = router;