const express = require('express');
const router = express.Router();
const cityController = require('../controllers/city.controller');
const district = require('../controllers/districts.controller');
const postalCode = require('../controllers/postalCode.controller');
const validateToken = require('../middleware/validateToken');

// cities
router.post('/',validateToken, cityController.createCity);
router.get('/', cityController.getAllCities);
router.put('/:cityId', validateToken,cityController.updateCity);
router.delete('/:cityId', validateToken,cityController.deleteCity);

// districts
router.post("/:cityId/districts",validateToken,district.addDistrict);
router.put("/:cityId/districts/:districtId",validateToken,district.updateDistrict);
router.delete("/:cityId/districts/:districtId",validateToken,district.deleteDistrict);

// postal code 
router.post("/:cityId/districts/:districtId/postalCodes",validateToken,postalCode.addPostalCode);
router.put("/:cityId/districts/:districtId/postalCodes/:postalId",validateToken,postalCode.updatePostalCode)
router.delete("/:cityId/districts/:districtId/postalCodes/:postalId",validateToken,postalCode.deletePostalCode)

module.exports = router;
