// --- Updated initSocket.js with Online Users and Seen Fix ---
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { sendNotification } = require("../utils/notify");

let io;
const onlineUsers = new Map();

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [process.env.front_url, "http://localhost:3001"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`New client connected: ${socket.id}`);

    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        socket.userId = decoded.id;
        socket.join(socket.userId);

        // track online user
        onlineUsers.set(socket.userId, socket.id);
        io.emit("onlineUsers:update", Array.from(onlineUsers.keys()));

        console.log(`Socket joined room for user ${socket.userId}`);
      } catch (err) {
        console.error("Invalid socket token", err.message);
      }
    }

    // Join conversation
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
      console.log(
        `User ${socket.userId} joined conversation ${conversationId}`
      );
    });

    // leave conversation room
    socket.on("leaveConversation", (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationId);
      console.log(`socket ${socket.id} left conv ${conversationId}`);
    });

    // Send message
    socket.on("sendMessage", async (data, ack) => {
      // console.log("data", data);

      try {
        const conv = await Conversation.findById(data.conversationId).populate(
          "members"
        );

        // console.log("conv", conv);

        if (
          !conv.members.some(
            (m) => String(m._id || m) === String(socket.userId)
          )
        ) {
          return ack({ ok: false, error: "Not allowed" });
        }

        console.log("aaaaaaaaaaaaa");

        const msg = await Message.create({
          conversation: data.conversationId,
          sender: socket.userId,
          text: data.text,
          attachments: data.attachments || [],
        });

        await Conversation.findByIdAndUpdate(data.conversationId, {
          lastMessage: msg._id,
          updatedAt: new Date(),
          deletedFor: [],
        });
        const fullMsg = await Message.findById(msg._id).populate(
          "sender",
          "firstName lastName image"
        );

        const receivers = conv.members.filter(
          (x) => x._id.toString() !== msg.sender.toString()
        );

        console.log("recevicers", receivers);

        receivers.forEach(async (user) => {
          // console.log("convttt",conv)

          // Ask receiver if they already have this conversation
          // await  io.to(userId.toString()).emit("conversation:check", {
          //       conversationId: conv._id,
          //       fullConversation: conv,
          //       lastMessage: fullMsg,
          //       senderId: socket.userId, // the original sender
          //     });

          const userId = user._id;

          io.to(userId.toString()).emit("message:new", fullMsg, conv);

          // ask receiver if conversation is active
          io.to(userId.toString()).emit("check:activeConversation", {
            conversationId: data.conversationId,
            message: fullMsg,
            receiverId: userId.toString(),
          });

          // if receiver is in conversation room, mark seen immediately
          const socketsInRoom = await io.in(userId.toString()).fetchSockets();
          socketsInRoom.forEach(async (s) => {
            if (s.rooms.has(data.conversationId)) {
              await markConversationSeen(data.conversationId, userId);
              io.to(data.conversationId).emit("message:seen", {
                conversationId: data.conversationId,
                userId: userId.toString(),
                lastMessage: fullMsg,
              });
            }
          });
        });

        ack({ ok: true, message: fullMsg });
      } catch (err) {
        console.log("sendMessage error:", err.message);
        ack({ ok: false, error: err.message });
      }
    });

    socket.on(
      "conversation:exists",
      ({ conversationId, exists, fullConversation, senderId }) => {
        console.log(
          "conversation:exists",
          conversationId,
          exists,
          fullConversation,
          socket.userId
        );
        if ((!exists, socket.userId)) {
          io.to(socket.userId).emit("conversation:new", fullConversation);
        }
      }
    );

    socket.on("deleteConversation", async ({ conversationId }) => {
      try {
        const userId = socket.userId;

        const conv = await Conversation.findById(conversationId);
        if (!conv) return;

        // soft delete
        if (!conv.deletedFor.includes(userId)) {
          conv.deletedFor.push(userId);
          await conv.save();
        }

        const otherUser = conv.members.find((m) => m.toString() !== userId);

        // notify other user
        io.to(otherUser.toString()).emit("conversation:deleted", {
          conversationId,
          deletedBy: userId,
        });

        // notify self UI
        io.to(userId.toString()).emit("conversation:deleted", {
          conversationId,
          deletedBy: userId,
        });
      } catch (err) {
        console.error("deleteConversation error:", err.message);
      }
    });

    // Typing
    socket.on("typing", ({ conversationId, typing, receiverId }) => {
      socket
        .to(receiverId)
        .emit("typing", { userId: socket.userId, typing, conversationId });
    });

    // receive notification from receiver that chat is not active
    socket.on("message:notActive", ({ receiverId, text, conversationId }) => {
      // Notify provider about offer acceptance
      sendNotification({
        recipientId: receiverId,
        senderId: socket.userId,
        type: "message",
        message: text,
        relatedId: conversationId,
      });
    });

    // Delivered & Seen Helpers
    async function markMessageDelivered(messageId, userId) {
      const msg = await Message.findById(messageId);
      if (!msg) return null;
      if (!msg.deliveredTo.find((id) => id.toString() === userId.toString())) {
        msg.deliveredTo.push(userId);
        await msg.save();
      }
      return msg;
    }

    async function markConversationSeen(conversationId, userId) {
      const unreadMessages = await Message.find({
        conversation: conversationId,
        sender: { $ne: userId },
        seenBy: { $ne: userId },
      }).select("_id");

      const ids = unreadMessages.map((m) => m._id);
      if (ids.length > 0)
        await Message.updateMany(
          { _id: { $in: ids } },
          { $addToSet: { seenBy: userId } }
        );
      return ids;
    }

    socket.on("message:delivered", async ({ messageId }) => {
      try {
        const updated = await markMessageDelivered(messageId, socket.userId);
        if (!updated) return;
        const senderId = updated.sender.toString();
        io.to(senderId).emit("message:delivered", {
          messageId: updated._id,
          deliveredTo: updated.deliveredTo,
        });
        updateUnreadCountForConversation(updated.conversation.toString());
      } catch (err) {
        console.error("message:delivered error:", err.message);
      }
    });

    socket.on("conversation:seen", async ({ conversation }) => {
      try {
        const seenMessageIds = await markConversationSeen(
          conversation._id,
          socket.userId
        );

        console.log("seenMessageIds", seenMessageIds);

        const senderId = conversation.members.find(
          (id) => String(id._id) !== String(socket.userId)
        );

        if (seenMessageIds && seenMessageIds.length) {
          console.log("from open in sennn");

          const lastMsg = await Message.findOne({
            conversation: conversation._id,
          })
            .sort({ createdAt: -1 })
            .populate("sender", "firstName lastName image")
            .lean();

          console.log("senderId", senderId);
          console.log("senderid", socket.userId);

          io.to(senderId._id).emit("message:seen", {
            conversationId: conversation._id,
            userId: socket.userId,
            lastMessage: lastMsg || null,
          });
        }
      } catch (err) {
        console.error("conversation:seen error:", err.message);
      }
    });

    async function updateUnreadCountForConversation(conversationId) {
      try {
        const conv = await Conversation.findById(conversationId)
          .select("members")
          .lean();
        if (!conv) return;
        for (const memberId of conv.members) {
          const unreadCount = await Message.countDocuments({
            conversation: mongoose.Types.ObjectId(conversationId),
            sender: { $ne: mongoose.Types.ObjectId(memberId) },
            seenBy: { $ne: mongoose.Types.ObjectId(memberId) },
          });
          io.to(memberId.toString()).emit("conversation:unread", {
            conversationId,
            unreadCount,
          });
        }
      } catch (err) {
        console.error("updateUnreadCountForConversation error:", err.message);
      }
    }

    socket.on("disconnect", () => {
      if (socket.userId) onlineUsers.delete(socket.userId);
      io.emit("onlineUsers:update", Array.from(onlineUsers.keys()));
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

const getSocket = () => {
  if (!io) throw new Error("Socket not initialized. Call initSocket first.");
  return io;
};

module.exports = { initSocket, getSocket };
