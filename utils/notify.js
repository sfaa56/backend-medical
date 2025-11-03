const Notification = require("../models/Notification");
const { getSocket } = require("../config/socket");

/**
 * sendNotification({ recipientId, senderId, type, message, relatedId, data, io })
 * - io optional (Socket.IO server instance) — if provided, emits real-time event
 */
exports.sendNotification = async ({
  recipientId,
  senderId,
  type,
  message,
  relatedId = null,
  data = null,
}) => {
  try {
    // 1️⃣ create
    let notif = await Notification.create({
      recipientId,
      senderId,
      type,
      message,
      relatedId,
      data,
    });

    // 2️⃣ populate sender
    notif = await notif.populate({
      path: "senderId",
      select: "firstName role image",
    });

    // 3️⃣ emit via socket
    const io = getSocket();
    io.to(recipientId.toString()).emit("notification:new", notif);

    return notif;
  } catch (err) {
    console.error("❌ notify error:", err);
    return null;
  }
};