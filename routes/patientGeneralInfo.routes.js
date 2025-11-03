const express = require("express");
const router = express.Router();
const {
  getGeneralInfo,
  updatechronicConditions,
  addSurgery,
  addAllergy,
  deleteAllergy,
  deleteSurgery

} = require("../controllers/patientGeneralInfo.controller");

const validateToken = require('../middleware/validateToken');

// ✅ Get or update general info
router.get("/:clientId", validateToken, getGeneralInfo);

router.patch("/", validateToken, updatechronicConditions);

// ✅ Add surgery or allergy
router.post("/add-surgery", validateToken, addSurgery);


router.post("/add-allergy", validateToken, addAllergy);


// delete surgery or allergy can be added similarly
router.delete("/delete-surgery/:surgeryId", validateToken, deleteSurgery);

router.delete("/delete-allergy/:allergyId", validateToken, deleteAllergy);
module.exports = router;
