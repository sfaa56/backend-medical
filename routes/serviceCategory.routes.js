const express = require("express");
const router = express.Router();

const {
  createServiceCategory,
  updateServiceCategory,
  getAllServiceCategories,
  deleteServiceCategory,
  getCategoriesBySpecialty,
} = require("../controllers/serviceCategory.controller");

const vierifyToken = require("../middleware/validateToken");

router.post("/", vierifyToken, createServiceCategory);
router.put("/:id", vierifyToken, updateServiceCategory);
router.get("/", getAllServiceCategories);
router.delete("/:id", vierifyToken, deleteServiceCategory);

router.get("/:specialtyId", getCategoriesBySpecialty);

module.exports = router;
