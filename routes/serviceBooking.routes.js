const express = require("express");
const router = express.Router();

const {
  createBookingRequest,
  getBookingsForProvider,
  acceptBookingRequest,
  rejectBookingRequest,
  updateBookingRequest,
  cancelBookingRequest,
  getBookingsForClient,
getBookingById
} = require("../controllers/serviceBooking.controller");

const validateToken = require("../middleware/validateToken");

router.get("/byId/:id",validateToken,getBookingById)

// ✅ Client actions
router.post("/", validateToken, createBookingRequest);
router.get("/client", validateToken, getBookingsForClient);
router.patch("/:id", validateToken, updateBookingRequest);      
router.patch("/:id/cancel", validateToken, cancelBookingRequest); 

// ✅ Provider actions
router.get("/provider", validateToken, getBookingsForProvider);
router.patch("/:id/accept", validateToken, acceptBookingRequest);
router.patch("/:id/reject", validateToken, rejectBookingRequest);

module.exports = router;
