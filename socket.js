// socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Conversation = require("./src/models/Conversation");

let io;

module.exports = {
  init: (httpServer, allowedOrigins) => {
    io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true
      }
    });

    // // 1. JWT Authentication Middleware for WebSockets
    // io.use((socket, next) => {
    //   const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    //   if (!token) {
    //     return next(new Error("Authentication error: Token missing"));
    //   }

    //   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    //     if (err) {
    //       return next(new Error("Authentication error: Invalid or expired token"));
    //     }
    //     socket.user = decoded;
    //     next();
    //   });
    // });

    // 2. Connection and Room Management
    io.on("connection", (socket) => {
      console.log(` authenticated user connected: User ID ${socket.user.id} | Socket ID ${socket.id}`);

      socket.on("join_conversation", async (conversationId) => {
        try {
          const conversation = await Conversation.findById(conversationId);

          if (!conversation) {
            return socket.emit("error", { message: "Conversation not found" });
          }

          // Authorization Check
          if (
            socket.user.id !== conversation.driver_id &&
            socket.user.id !== conversation.passenger_id
          ) {
            return socket.emit("error", { message: "Unauthorized room access" });
          }

          const roomName = `conversation_${conversationId}`;
          socket.join(roomName);
          console.log(`User ${socket.user.id} joined room: ${roomName}`);
        } catch (error) {
          console.error("Room Join Error:", error);
          socket.emit("error", { message: "Failed to join chat room" });
        }
      });

      // User leaves room
      socket.on("leave_conversation", (conversationId) => {
        const roomName = `conversation_${conversationId}`;
        socket.leave(roomName);
        console.log(`User ${socket.user.id} left room: ${roomName}`);
      });

      socket.on("disconnect", () => {
        console.log(`User disconnected: ID ${socket.user.id}`);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io is not initialized!");
    }
    return io;
  }
};