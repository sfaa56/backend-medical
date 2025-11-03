const express = require('express');
const router = express.Router();
const serviceRequestController = require('../controllers/serviceRequest.controller');
const validateToken = require('../middleware/validateToken');


router.post('/', validateToken,serviceRequestController.createRequest);
router.get('/', serviceRequestController.getAllRequests);
router.get('/:id', serviceRequestController.getRequestById);
router.put('/:id', validateToken,serviceRequestController.updateRequest);
router.delete('/:id', validateToken,serviceRequestController.deleteRequest);
router.get('/client/:id', validateToken,serviceRequestController.getRequestsByClientId);

router.get('/Kpi/client',validateToken,serviceRequestController.getClientKPI)

module.exports = router;
