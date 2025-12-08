const express = require("express");
const router = express.Router();
const {
  getMessages,
  deleteMessage
} = require("../controllers/messageController");
const validateToken = require("../middleware/validateToken");

router.get("/:id", validateToken, getMessages);
router.delete("/:id", validateToken, deleteMessage);

module.exports = router;
