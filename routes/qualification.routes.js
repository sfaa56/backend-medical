// routes/qualificationRoutes.js
const express = require("express");
const router = express.Router();
const qualificationController = require("../controllers/qualification.controller");
const validateToken = require("../middleware/validateToken");

router.post("/:userId", validateToken, qualificationController.addQualification);
router.get("/user/:userId", qualificationController.getQualificationsByUser);
router.put("/:id", validateToken, qualificationController.updateQualification);
router.delete(
  "/:id",
  validateToken,
  qualificationController.deleteQualification
);

module.exports = router;
