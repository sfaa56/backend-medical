
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const  validateToken  = require("../middleware/validateToken");
const { createReview, getProviderReviews, getProviderRatingSummary,getProviderReviewStats } = require('../controllers/review.controller');



// ✅ Client creates review for appointment
router.post("/appointments/:id/review", validateToken, createReview);

// ✅ Get all reviews for provider
router.get("/providers/:id/reviews", getProviderReviews);

// ✅ Get provider rating summary
router.get("/providers/:id/rating", getProviderRatingSummary);

router.get("/providers/:id/stats", getProviderReviewStats);


router.post('/', reviewController.createReview);
router.get('/', reviewController.getAllReviews);
router.get('/:id', reviewController.getReviewById);
router.put('/:id', reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);



module.exports = router;
