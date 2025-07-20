const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const validateToken = require('../middleware/validateToken');

router.post('/', validateToken,bookingController.createBooking);
router.get('/', bookingController.getAllBookings);
router.get('/:id', bookingController.getBookingById);
router.put('/:id', validateToken,bookingController.updateBooking);
router.delete('/:id', validateToken,bookingController.deleteBooking);

module.exports = router;