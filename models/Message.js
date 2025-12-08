const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String },
  attachments: [{ url: String, type: String }],
      // Who has received (delivered) this message
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Who has seen (read) this message
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, enum: ['sent','delivered','seen'], default: 'sent' },
  createdAt: { type: Date, default: Date.now }
});

MessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
