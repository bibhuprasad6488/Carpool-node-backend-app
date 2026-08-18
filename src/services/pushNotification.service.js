const { firebaseMessaging } = require("../config/firebase");
const db = require("../config/db");

const notificationRepository = require("../models/pushnotification.model");

const sendPushNotification = async ({ token, title, body, data = {} }) => {
  const message = {
    token,
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)]),
    ),
  };
  return firebaseMessaging.send(message);
};

const sendNotificationToUser = async ({
  userId,
  title,
  body,
  type = "SYSTEM",
  data = {},
}) => {
  const devices = await notificationRepository.getDevicesByUserId(userId);

  if (!devices.length) {
    return {
      success: true,
      sent: 0,
      failed: 0,
      message: "No active notification devices found",
    };
  }

  const results = [];

  for (const device of devices) {
    if (!device.push_token) {
      continue;
    }

    try {
      const messageId = await sendPushNotification({
        token: device.push_token,
        title,
        body,
        data: {
          type,
          ...data,
        },
      });

      results.push({
        installationId: device.installation_id,
        success: true,
        messageId,
      });
    } catch (error) {
      console.error(
        `Failed to send notification to ${device.installation_id}`,
        error,
      );

      results.push({
        installationId: device.installation_id,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    success: true,

    sent: results.filter((item) => item.success).length,

    failed: results.filter((item) => !item.success).length,

    results,
  };
};

const sendBroadcast = async ({ title, body, type = "SYSTEM", data = {} }) => {
  // 1. Get all active notification devices

  const [devices] = await db.execute(`
        SELECT
            id,
            user_id,
            push_token,
            platform
        FROM notification_devices
        WHERE is_active = 1
          AND push_token IS NOT NULL
          AND push_token != ''
    `);

  if (!devices.length) {
    return {
      success: true,
      totalDevices: 0,
      sent: 0,
      failed: 0,
      message: "No active notification devices found.",
    };
  }

  // 2. Create notification record(s)

  // IMPORTANT:
  // We will improve this part depending on your
  // notifications table structure.
  const tokens = devices.map((device) => device.push_token);
  // 3. Firebase supports max 500 tokens per multicast request
  const chunkSize = 500;
  let sent = 0;
  let failed = 0;
  const results = [];
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);

    const message = {
      notification: {
        title,
        body,
      },

      data: {
        type,
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)]),
        ),
      },

      tokens: chunk,
    };

    const response = await firebaseMessaging.sendEachForMulticast(message);

    sent += response.successCount;
    failed += response.failureCount;

    results.push({
      successCount: response.successCount,

      failureCount: response.failureCount,
    });
  }

  return {
    success: failed === 0,
    totalDevices: devices.length,
    sent,
    failed,
    results,
  };
};

module.exports = {
  sendPushNotification,
  sendNotificationToUser,
  sendBroadcast,
};
