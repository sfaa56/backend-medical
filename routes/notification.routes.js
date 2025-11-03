const express = require("express");
const router = express.Router();
const validateToken = require('../middleware/validateToken');
const { getNotifications, markAsSeen, markAllAsSeen } = require("../controllers/notification.controller");

router.get("/", validateToken, getNotifications);
router.patch("/:id/seen", validateToken, markAsSeen);
router.patch("/seen-all", validateToken, markAllAsSeen);

module.exports = router;