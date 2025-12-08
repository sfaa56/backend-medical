const Notification = require("../models/Notification");

/**
 * sendNotification({ recipientId, senderId, type, message, relatedId, data })
 * - Emits real-time event if socket server is initialized.
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
    // 1) create notification record
    let notif = await Notification.create({
      recipientId,
      senderId,
      type,
      message,
      relatedId,
      data,
    });

    // 2) populate sender
    notif = await notif.populate({
      path: "senderId",
      select: "firstName role image",
    });

    // 3) emit via socket if available (lazy require to avoid circular import)
    try {
      // require lazily to avoid circular dependency problems
      const socketModule = require("../config/socket");
      if (socketModule && typeof socketModule.getSocket === "function") {
        const io = socketModule.getSocket();
        // safe recipientId -> string
        if (recipientId) io.to(String(recipientId)).emit("notification:new", notif);
      }
    } catch (emitErr) {
      // don't fail the whole operation if socket isn't ready or module cycles exist
      console.warn("notify: socket emit skipped:", emitErr.message);
    }

    return notif;
  } catch (err) {
    console.error("❌ notify error:", err);
    return null;
  }
};