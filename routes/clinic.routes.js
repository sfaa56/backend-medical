// routes/clinicRoutes.js
const express = require("express");
const router = express.Router();
const clinicController = require("../controllers/clinic.controller");
const validateToken = require("../middleware/validateToken");

router.post("/:userId",validateToken, clinicController.addClinic);
router.get("/user/:userId", clinicController.getClinicsByUser);
router.put("/:id", validateToken,clinicController.updateClinic);
router.delete("/:id", validateToken,clinicController.deleteClinic);
router.put("/:id/photo", validateToken,clinicController.updateClinicPhoto);



module.exports = router;
