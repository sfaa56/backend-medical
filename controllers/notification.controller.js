const Notification = require("../models/Notification");

// GET user's notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ recipientId: req.user.id }).populate({path: "senderId", select: "firstName role image "})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: notifs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// MARK as seen
exports.markAsSeen = async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id },
      { seen: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// MARK many as seen
exports.markAllAsSeen = async (req, res) => {
  try {
    await Notification.updateMany({ recipientId: req.user.id, seen: false }, { seen: true });
    res.json({ success: true, message: "All marked as seen" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
