const express = require('express');
const router = express.Router();
const serviceRequestController = require('../controllers/serviceRequest.controller');
const { verifyToken } = require('../middleware/validateToken');

router.post('/', verifyToken,serviceRequestController.createRequest);
router.get('/', serviceRequestController.getAllRequests);
router.get('/:id', serviceRequestController.getRequestById);
router.put('/:id', verifyToken,serviceRequestController.updateRequest);
router.delete('/:id', verifyToken,serviceRequestController.deleteRequest);
router.get('/client/:id', verifyToken,serviceRequestController.getRequestsByClientId);

module.exports = router;
