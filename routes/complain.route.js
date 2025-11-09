// routes/clinicRoutes.js
const express = require("express");
const router = express.Router();

const validateToken = require("../middleware/validateToken");

const {createComplaint ,getAllComplaints ,getComplaintById,updateComplaint} = require("../controllers/complaint.controller");


router.post("/",validateToken,createComplaint);

router.get("/all",validateToken,getAllComplaints);

router.get("/:id", validateToken,getComplaintById);

router.put("/:id", validateToken,updateComplaint);




module.exports = router;
