const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params; // conversationId
    const page = parseInt(req.query.page) || 1;
    const limit = 30;

    const messages = await Message.find({ conversation: id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", "firstName lastName image");

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



exports.deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);

    if (msg.sender.toString() !== req.user.id)
      return res.status(403).json({ message: "Not allowed" });

    await msg.deleteOne();
    req.io.to(msg.conversation.toString())
         .emit("message:deleted", { messageId: msg._id });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




