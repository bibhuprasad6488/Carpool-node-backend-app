const notificationRepository = require("../models/pushnotification.model");
const {
  sendPushNotification,
  sendBroadcast,
} = require("../services/pushNotification.service");

const registerDevice = async (req, res) => {
  try {
    const {
      installationId,
      pushToken,
      platform,
      deviceType,
      browser,
      appVersion,
      permissionStatus,
    } = req.body;

    const userId = req.user?.id || null;

    if (!installationId) {
      return res.status(400).json({
        success: false,
        message: "installationId is required",
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: "platform is required",
      });
    }

    const result = await notificationRepository.registerDevice({
      userId,
      installationId,
      pushToken,
      platform,
      deviceType,
      browser,
      appVersion,
      permissionStatus,
    });

    return res.status(200).json({
      success: true,
      message: "Notification device registered successfully",
      data: result,
    });
  } catch (error) {
    console.error("Register notification device error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register notification device",
    });
  }
};

const sendTestNotificationToUser = async ({
  userId,
  type,
  title,
  body,
  data = {},
}) => {
  const notificationId = await notificationRepository.createNotification({
    userId,
    type,
    title,
    body,
    data,
  });

  const devices = await notificationRepository.getActiveDevicesByUserId(userId);

  if (!devices.length) {
    return {
      success: true,
      notificationId,
      sent: 0,
      failed: 0,
      message: "Notification saved, but no active devices found",
    };
  }

  let sent = 0;
  let failed = 0;

  const results = [];

  for (const device of devices) {
    try {
      const messageId = await sendPushNotification({
        token: device.push_token,
        title,
        body,
        data: {
          ...data,
          notificationId,
        },
      });

      sent++;

      results.push({
        deviceId: device.id,
        success: true,
        messageId,
      });
    } catch (error) {
      failed++;

      results.push({
        deviceId: device.id,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    notificationId,
    sent,
    failed,
    results,
  };
};

const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID not found",
      });
    }

    console.log(`Sending test notification to user: ${userId}`);

    const result = await sendTestNotificationToUser({
      userId,
      type: "TEST_NOTIFICATION",
      title: "Carpooling Test 🔔",
      body: "Your push notification system is working!",
      data: {
        type: "TEST_NOTIFICATION",
        userId: userId,
        timestamp: Date.now(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Test notification processed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Send test notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send test notification",
      error: error.message,
    });
  }
};

const broadcastNotification = async (req, res) => {
  try {
    const { title, body, type = "SYSTEM", data = {} } = req.body;
    // Validate title
    if (!title || typeof title !== "string") {
      return res.status(400).json({
        success: false,
        message: "Notification title is required.",
      });
    }
    // Validate body
    if (!body || typeof body !== "string") {
      return res.status(400).json({
        success: false,
        message: "Notification body is required.",
      });
    }

    const result = await sendBroadcast({
      title: title.trim(),
      body: body.trim(),
      type,
      data,
      createdBy: req.user?.id || null,
    });

    return res.status(200).json({
      success: true,
      message: "Broadcast notification processed successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Broadcast notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send broadcast notification.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unreadOnly = "false" } = req.query;

    const result = await notificationRepository.getUserNotifications({
      userId,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      unreadOnly: unreadOnly === "true",
    });

    return res.status(200).json({
      status: "success",
      message: "Notifications retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("[GET NOTIFICATIONS ERROR]", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;

    if (!notificationIds) {
      return res.status(422).json({
        status: "error",
        message: "notificationIds parameter is required",
      });
    }

    const updatedRows = await notificationRepository.markAsRead(userId, notificationIds);

    return res.status(200).json({
      status: "success",
      message: `${updatedRows} notification(s) marked as read`,
    });
  } catch (error) {
    console.error("[MARK READ ERROR]", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedRows = await notificationRepository.markAllAsRead(userId);

    return res.status(200).json({
      status: "success",
      message: `All notifications marked as read (${updatedRows} updated)`,
    });
  } catch (error) {
    console.error("[MARK ALL READ ERROR]", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = {
  registerDevice,
  sendTestNotificationToUser,
  sendTestNotification,
  broadcastNotification,
  getNotifications,
  markAsRead,
  markAllAsRead
};
