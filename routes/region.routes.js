const express = require('express');
const router = express.Router();
const regionController = require('../controllers/regionController');
const validateToken = require('../middleware/validateToken');

router.post('/', validateToken,regionController.createRegion);
router.get('/', regionController.getAllRegions);
router.put('/:id', validateToken,regionController.updateRegion);
router.delete('/:id',validateToken ,regionController.deleteRegion);

module.exports = router;
