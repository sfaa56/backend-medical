const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");



exports.startConversation = async (req, res) => {
  try {
    const { userId } = req.body; // the other user
    const myId = req.user.id;

    if (userId === myId)
      return res.status(400).json({ message: "Cannot chat with yourself" });

    // Check if already exists
    let conv = await Conversation.findOne({
      members: { $all: [myId, userId] },
    }).populate("members", "firstName lastName image");

    if (!conv) {
      conv = await Conversation.create({
        members: [myId, userId],
      });

      conv = await conv.populate("members", "firstName lastName image");
    }

    res.json(conv);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getMyConversations = async (req, res) => {
  try {
    const convs = await Conversation.find({
      members: req.user.id,
      deletedFor: { $ne: req.user.id },
    })
      .sort({ updatedAt: -1 })
      .populate("members", "firstName lastName image isDeleted")
      .populate("lastMessage")
      .lean(); // Add .lean() to get plain objects

    // Now compute unread count
    const convsWithUnread = await Promise.all(
      convs.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: req.user.id },
          seenBy: { $ne: req.user.id },
        });

        console.log(`conv ${conv._id} unreadCount:`, unreadCount);

        return {
          ...conv,
          unreadCount,
        };
      })
    );

    console.log("convs", convsWithUnread);
    res.json(convsWithUnread);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getConversationById = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id)
      .populate("members", "firstName lastName image isDeleted")
      .populate("lastMessage");

    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUnreadCounts = async (req, res) => {
  try {
    const userId = req.user.id;

    const convs = await Conversation.find({ members: userId })
      .select("_id members")
      .lean();

    const results = [];
    for (const conv of convs) {
      const unreadCount = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: userId },
        seenBy: { $ne: userId },
      });
      results.push({ conversationId: conv._id, unreadCount });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    // mark deleted for this user
    if (!conv.deletedFor.includes(userId)) {
      conv.deletedFor.push(userId);
      await conv.save();
    }


    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// get at least if conv has unread messages for dot indicator
exports.hasUnreadMessages = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("userId",userId);

    const convIds = await Conversation.find({ members: userId })
      .distinct("_id");

    const hasUnread = await Message.exists({
      conversation: { $in: convIds },
      sender: { $ne: userId },
      seenBy: { $ne: userId }
    });

    res.json({ hasUnreadMessage: !!hasUnread });
  } catch (err) {
    console.log("errr",err)
    res.status(500).json({ message: err.message });
  }
};

