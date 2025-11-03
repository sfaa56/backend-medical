const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

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
        socket.join(socket.userId); // join room by user id

        console.log(`Socket joined room for user ${socket.id}`);
      } catch (err) {
        console.error("Invalid socket token", err.message);
      }
    }

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

const getSocket = () => {
  if (!io) {
    throw new Error("Socket not initialized. Call initSocket first.");
  }
  return io;
};

module.exports = { initSocket, getSocket };
