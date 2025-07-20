const express = require('express');
const router = express.Router();
const { createProviderService, getServicesByProvider } = require('../controllers/providerServiceController');
const validateToken = require('../middleware/validateToken');

router.post('/',validateToken, createProviderService);
router.get('/:providerId', getServicesByProvider);

module.exports = router;
