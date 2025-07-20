const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offer.controller');
const validateToken = require('../middleware/validateToken');

router.post('/', validateToken,offerController.createOffer);
router.get('/', offerController.getAllOffers);
router.get('/:id', offerController.getOfferById);
router.put('/:id', offerController.updateOffer);
router.delete('/:id', validateToken,offerController.deleteOffer);

module.exports = router;
