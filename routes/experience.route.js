const express = require("express");
const router = express.Router();
const {addExperience,updateExperience,deleteExperience,getExperiencesByUser} = require("../controllers/experienc.controller");
const validateToken = require("../middleware/validateToken");

router.post("/:userId",validateToken, addExperience);
router.put("/:id", validateToken,updateExperience);
router.delete("/:userId/:id", validateToken,deleteExperience);
router.get("/:userId",getExperiencesByUser);

module.exports = router;
