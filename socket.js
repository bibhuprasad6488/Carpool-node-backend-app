// socket.js
const { Server } = require("socket.io");
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

    // Public connection handler (No JWT check on connection)
    io.on("connection", (socket) => {
      console.log(`Socket connected: ID ${socket.id}`);

      // Client passes both conversationId AND userId when joining
      socket.on("join_conversation", async ({ conversationId, userId }) => {
        try {
          if (!conversationId || !userId) {
            return socket.emit("error", { message: "conversationId and userId are required" });
          }

          const conversation = await Conversation.findById(conversationId);

          if (!conversation) {
            return socket.emit("error", { message: "Conversation not found" });
          }

          // Convert IDs to numbers to ensure safe comparison
          const numericUserId = Number(userId);
          const driverId = Number(conversation.driver_id);
          const passengerId = Number(conversation.passenger_id);

          // Verify if the claiming user is part of this conversation
          if (numericUserId !== driverId && numericUserId !== passengerId) {
            return socket.emit("error", { message: "Unauthorized room access" });
          }

          const roomName = `conversation_${conversationId}`;
          socket.join(roomName);
          console.log(`User ${userId} (Socket ${socket.id}) joined room: ${roomName}`);

          socket.emit("joined_room", { room: roomName, success: true });
        } catch (error) {
          console.error("Room Join Error:", error);
          socket.emit("error", { message: "Failed to join chat room" });
        }
      });

      // User leaves room
      socket.on("leave_conversation", (conversationId) => {
        const roomName = `conversation_${conversationId}`;
        socket.leave(roomName);
        console.log(`Socket ${socket.id} left room: ${roomName}`);
      });

      socket.on("join_ride", (rideId) => {
        socket.join(`ride-${rideId}`);

        console.log(
          `Socket ${socket.id} joined ride room: ride-${rideId}`
        );

        socket.emit("ride_joined", {
          room: `ride-${rideId}`,
          success: true,
        });
      });
      
      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ID ${socket.id}`);
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