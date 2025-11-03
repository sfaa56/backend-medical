const express = require('express');
const router = express.Router();
const { getAllServices,createProviderService,getServiceById, getServicesByProvider, updateProviderService, deleteProviderService } = require('../controllers/providerService.Controller');
const validateToken = require('../middleware/validateToken');


router.get('/',getAllServices);
router.get('/:serviceId',validateToken, getServiceById);
router.post('/',validateToken, createProviderService);
router.put('/:id',validateToken,updateProviderService);
router.delete('/:id',validateToken,deleteProviderService);
router.get('/:providerId', getServicesByProvider);



module.exports = router;
