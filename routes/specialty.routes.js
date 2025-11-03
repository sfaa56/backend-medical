const express = require('express');
const router = express.Router();
const { getSpecialtyStats,createSpecialty, getAllSpecialties,updateSpecialty,deleteSpecialty,deleteSpecialtyFromUser } = require('../controllers/specialtyController');
const validateToken = require('../middleware/validateToken');

router.post('/create',validateToken, createSpecialty);
router.get('/', getAllSpecialties);
router.put('/update/:id', validateToken, updateSpecialty); // Assuming update uses the same controller logic as create
router.delete('/delete/:id', validateToken,deleteSpecialty);

router.delete('/deleteFromUser/:specialtyId',validateToken,deleteSpecialtyFromUser);

router.get('/getSpecialtyStats',getSpecialtyStats)

module.exports = router;
