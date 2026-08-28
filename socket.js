// socket.js
const { Server } = require("socket.io");
const Conversation = require("./src/models/Conversation");
const Ride = require("./src/models/Ride");

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

      // 1. Join Personal User Room for Targeted Notifications
      socket.on("join_user_room", (userId) => {
        if (userId) {
          const roomName = `user_${userId}`;
          socket.join(roomName);
          console.log(
            `👤 Socket ${socket.id} joined personal room: ${roomName}`,
          );
        }
      });

      // 2. Join Conversation Room
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

      socket.on("leave_conversation", (conversationId) => {
        const roomName = `conversation_${conversationId}`;
        socket.leave(roomName);
        console.log(`Socket ${socket.id} left room: ${roomName}`);
      });

      socket.on("join_ride", (rideId) => {
        const roomName = `ride_${rideId}`;
        socket.join(roomName);
        console.log(`🚗 Socket ${socket.id} joined ride room: ${roomName}`);

        socket.emit("ride_joined", {
          room: roomName,
          success: true,
        });
      });

      socket.on("driver_location", async (data) => {
        try {
          const {
            rideId,
            latitude,
            longitude,
            heading,
            speed,
          } = data;

          if (!rideId || latitude === undefined || longitude === undefined) {
            return socket.emit("error", {
              message: "rideId, latitude and longitude are required",
            });
          }

          // Driver must be the authenticated driver
          if (!socket.isRideDriver || Number(socket.rideId) !== Number(rideId)) {
            return socket.emit("error", {
              message: "Unauthorized location update",
            });
          }

          // Check ride is still ongoing
          const ride = await Ride.rideDetailsById(rideId);

          if (!ride) {
            return socket.emit("error", {
              message: "Ride not found",
            });
          }

          if (ride.status !== "ongoing") {
            return socket.emit("error", {
              message: "Location tracking is not active",
            });
          }

          // Broadcast to passengers/driver in ride room
          io.to(`ride_${rideId}`).emit("driver_location_updated",
            {
              rideId: Number(rideId),
              latitude: Number(latitude),
              longitude: Number(longitude),
              heading:
                heading !== undefined
                  ? Number(heading)
                  : null,
              speed:
                speed !== undefined
                  ? Number(speed)
                  : null,
            },
          );

        } catch (error) {
          console.error(
            "[DRIVER LOCATION ERROR]",
            error
          );

          socket.emit("error", {
            message: "Failed to update driver location",
          });
        }
      });

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
