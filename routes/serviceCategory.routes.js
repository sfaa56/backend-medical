const express = require('express');
const router = express.Router();
const { createCategory, getCategoriesBySpecialty } = require('../controllers/serviceCategoryController');
const vierifyToken = require('../middleware/verifyToken');

router.post('/',vierifyToken ,createCategory);
router.get('/:specialtyId', getCategoriesBySpecialty);

module.exports = router;


