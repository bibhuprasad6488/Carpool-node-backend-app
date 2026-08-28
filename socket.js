// socket.js
const { Server } = require("socket.io");
const Conversation = require("./src/models/Conversation");

let io;

module.exports = {
  init: (httpServer, allowedOrigins) => {
    io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    io.on("connection", (socket) => {
      console.log(`⚡ Socket connected: ID ${socket.id}`);

      // 1. Live Tracking Room Join
      socket.on("ride:join_room", (data) => {
        const rideId = typeof data === "object" ? data?.rideId : data;
        if (!rideId) return;

        const roomName = `ride_${rideId}`;
        socket.join(roomName);
        console.log(
          `Socket ${socket.id} joined live tracking room: ${roomName}`,
        );

        socket.emit("ride:room_joined", { room: roomName, success: true });
      });

      // 2. Leave Live Tracking Room
      socket.on("ride:leave_room", (data) => {
        const rideId = typeof data === "object" ? data?.rideId : data;
        if (!rideId) return;

        const roomName = `ride_${rideId}`;
        socket.leave(roomName);
        console.log(`Socket ${socket.id} left room: ${roomName}`);
      });

      // 3. Driver Sends Live Location Updates (Relayed to passengers in room)
      socket.on("driver:update_location", (data) => {
        const { rideId, latitude, longitude, heading, speed } = data || {};
        if (!rideId || !latitude || !longitude) return;

        const roomName = `ride_${rideId}`;
        socket.to(roomName).emit("ride:location_updated", {
          rideId,
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          timestamp: new Date().toISOString(),
        });
      });

      // 4. Personal User Room for Push Notifications / In-App Alerts
      socket.on("join_user_room", (userId) => {
        if (userId) {
          const roomName = `user_${userId}`;
          socket.join(roomName);
          console.log(
            `👤 Socket ${socket.id} joined personal room: ${roomName}`,
          );
        }
      });

      // 5. Conversation / Chat Room Join (Authenticated)
      socket.on("join_conversation", async ({ conversationId, userId }) => {
        try {
          if (!conversationId || !userId) {
            return socket.emit("error", {
              message: "conversationId and userId are required",
            });
          }

          const conversation = await Conversation.findById(conversationId);

          if (!conversation) {
            return socket.emit("error", { message: "Conversation not found" });
          }

          const numericUserId = Number(userId);
          const driverId = Number(conversation.driver_id);
          const passengerId = Number(conversation.passenger_id);

          if (numericUserId !== driverId && numericUserId !== passengerId) {
            return socket.emit("error", {
              message: "Unauthorized room access",
            });
          }

          const roomName = `conversation_${conversationId}`;
          socket.join(roomName);
          console.log(
            `💬 User ${userId} (Socket ${socket.id}) joined room: ${roomName}`,
          );

          socket.emit("joined_room", { room: roomName, success: true });
        } catch (error) {
          console.error("Room Join Error:", error);
          socket.emit("error", { message: "Failed to join chat room" });
        }
      });

      // 6. Leave Conversation Room
      socket.on("leave_conversation", (conversationId) => {
        if (!conversationId) return;
        const roomName = `conversation_${conversationId}`;
        socket.leave(roomName);
        console.log(`Socket ${socket.id} left room: ${roomName}`);
      });

      // 7. Dedicated Seat Updates & Booking Sync Listener (Kept intact)
      socket.on("join_ride", (payload) => {
        const rideId = typeof payload === "object" ? payload?.rideId : payload;
        if (!rideId) return;

        const roomName = `ride_${rideId}`;
        socket.join(roomName);
        console.log(
          `🚗 Socket ${socket.id} joined ride seat update room: ${roomName}`,
        );

        socket.emit("ride_joined", {
          room: roomName,
          success: true,
        });
      });

      // 8. Disconnect Handler
      socket.on("disconnect", (reason) => {
        console.log(
          `❌ Socket disconnected: ID ${socket.id} (Reason: ${reason})`,
        );
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io is not initialized!");
    }
    return io;
  },
};
