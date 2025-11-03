const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offer.controller');
const validateToken = require('../middleware/validateToken');

router.post('/', validateToken,offerController.createOffer);
router.get('/', offerController.getAllOffers);
router.get('/getOffer/:id', offerController.getOfferById);
router.get('/getProviderOffers',validateToken,offerController.getOffersByProvider);
router.patch("/:offerId/accept", validateToken,offerController.acceptOffer);

router.put('/:id', offerController.updateOffer);
router.delete('/:id', validateToken,offerController.deleteOffer);

module.exports = router;
