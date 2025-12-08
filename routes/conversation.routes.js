const express = require("express");
const router = express.Router();
const {
  startConversation,
  getMyConversations,
  getConversationById,
  getUnreadCounts,
  deleteConversation,
  hasUnreadMessages
} = require("../controllers/conversationController");
const validateToken = require("../middleware/validateToken");

router.use((req, res, next) => {
  console.log("🔥 Conversations Router HIT:", req.method, req.originalUrl);
  next();
});


router.post("/", validateToken, startConversation);
router.get("/", validateToken, getMyConversations);
router.get("/:id", validateToken, getConversationById);
router.get("/unread-counts", validateToken, getUnreadCounts);
router.delete("/:id",validateToken,deleteConversation);

router.get("/indicator/messages",validateToken,hasUnreadMessages)

module.exports = router;
