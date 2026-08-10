const { getIO } = require("../../socket");

const NOTIFICATION_TYPES = {
  RIDE_BOOKED: "RIDE_BOOKED",
  RIDE_PUBLISHED: "RIDE_PUBLISHED",
  RIDE_CANCELLED: "RIDE_CANCELLED",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  USER_REGISTERED: "USER_REGISTERED",
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

module.exports = {
  NOTIFICATION_TYPES,
  sendAdminNotification,
};
