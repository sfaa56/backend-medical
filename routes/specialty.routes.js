const express = require('express');
const router = express.Router();
const { createSpecialty, getAllSpecialties,updateSpecialty,deleteSpecialty } = require('../controllers/specialtyController');
const validateToken = require('../middleware/validateToken');

router.post('/create',validateToken, createSpecialty);
router.get('/', getAllSpecialties);
router.put('/update/:id', validateToken, updateSpecialty); // Assuming update uses the same controller logic as create
router.delete('/delete/:id', validateToken,deleteSpecialty);

module.exports = router;
