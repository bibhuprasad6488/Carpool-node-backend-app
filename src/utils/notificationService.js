const { getIO } = require("../../socket");

const NOTIFICATION_TYPES = {
  // Ride lifecycle
  RIDE_BOOKED: "RIDE_BOOKED",
  RIDE_PUBLISHED: "RIDE_PUBLISHED",
  RIDE_CANCELLED: "RIDE_CANCELLED",
  RIDE_STARTED: "RIDE_STARTED",
  RIDE_COMPLETED: "RIDE_COMPLETED",

  // Finance & Account
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  USER_REGISTERED: "USER_REGISTERED",

  // Social & Safety
  CONVERSATION: "CONVERSATION",
  RATINGS: "RATINGS",
  EMERGENCY: "EMERGENCY",
};

const sendAdminNotification = ({ type, title, message, data = {} }) => {
  try {
    const io = getIO();

    const payload = {
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    io.to("admin-control-room").emit("admin_notification", payload);

    console.log(`[ADMIN NOTIFICATION SENT] (${type}): ${title}`);
  } catch (error) {
    console.error("[ADMIN NOTIFICATION ERROR]", error.message);
  }
};

const sendUserNotification = ({ userId, type, title, message, data = {} }) => {
  try {
    if (!userId) {
      throw new Error("userId is required to send user notification");
    }

    const io = getIO();

    const payload = {
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    // Target the specific user's socket room
    const userRoom = `user_${userId}`;
    io.to(userRoom).emit("user_notification", payload);

    console.log(
      `[USER NOTIFICATION SENT] [Room: ${userRoom}] (${type}): ${title}`,
    );
  } catch (error) {
    console.error("[USER NOTIFICATION ERROR]", error.message);
  }
};

const sendRideRoomNotification = ({
  rideId,
  type,
  title,
  message,
  data = {},
}) => {
  try {
    if (!rideId) {
      throw new Error("rideId is required for room broadcast");
    }

    const io = getIO();

    const payload = {
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    const rideRoom = `ride_${rideId}`;
    io.to(rideRoom).emit("ride_notification", payload);

    console.log(
      `[RIDE ROOM NOTIFICATION SENT] [Room: ${rideRoom}] (${type}): ${title}`,
    );
  } catch (error) {
    console.error("[RIDE ROOM NOTIFICATION ERROR]", error.message);
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  sendAdminNotification,
  sendUserNotification,
  sendRideRoomNotification,
};
