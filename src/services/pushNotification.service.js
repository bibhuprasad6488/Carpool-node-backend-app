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
  let notificationId = null;
  try {
    notificationId = await notificationRepository.createNotification({
      userId,
      type,
      title,
      body,
      data,
    });
  } catch (dbError) {
    console.error("Failed to insert notification into DB:", dbError);
  }

  const devices = await notificationRepository.getDevicesByUserId(userId);

  if (!devices.length) {
    return {
      success: true,
      notificationId,
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
          notificationId,
          ...data,
        },
      });

      results.push({
        installationId: device.installation_id,
        success: true,
        messageId,
      });
    } catch (error) {
      // Check for FCM Unregistered / Invalid Token Error Codes
      const isUnregisteredToken =
        error.code === "messaging/registration-token-not-registered" ||
        error.errorInfo?.code ===
          "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-registration-token";

      if (isUnregisteredToken) {
        console.warn(
          `[Push Notification] Stale token detected for installation ${device.installation_id}. Removing/Deactivating token.`,
        );

        try {
          if (notificationRepository.deleteDeviceByInstallationId) {
            await notificationRepository.deleteDeviceByInstallationId(
              device.installation_id,
            );
          } else if (notificationRepository.deactivateDevice) {
            await notificationRepository.deactivateDevice(
              device.installation_id,
            );
          }
        } catch (cleanupError) {
          console.error("Failed to clean up stale push token:", cleanupError);
        }
      } else {
        console.error(
          `Failed to send notification to ${device.installation_id}:`,
          error.message || error,
        );
      }

      results.push({
        installationId: device.installation_id,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    notificationId,
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

  const uniqueUserIds = [...new Set(devices.map((d) => d.user_id))];

  if (uniqueUserIds.length > 0) {
    try {
      const serializedData = JSON.stringify(data);

      // Build bulk insert SQL: INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?), ...
      const placeholders = uniqueUserIds
        .map(() => "(?, ?, ?, ?, ?)")
        .join(", ");
      const insertValues = uniqueUserIds.flatMap((userId) => [
        userId,
        type,
        title,
        body,
        serializedData,
      ]);

      await db.execute(
        `INSERT INTO notifications (user_id, type, title, body, data) VALUES ${placeholders}`,
        insertValues,
      );
    } catch (dbError) {
      console.error(
        "[Broadcast] Failed to bulk insert notifications:",
        dbError,
      );
    }
  }

  // 3. Prepare FCM Multicast chunks (Max 500 per request)
  const chunkSize = 500;
  let sent = 0;
  let failed = 0;
  const results = [];
  const staleDeviceIds = [];

  for (let i = 0; i < devices.length; i += chunkSize) {
    const deviceChunk = devices.slice(i, i + chunkSize);
    const tokensChunk = deviceChunk.map((device) => device.push_token);

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
      tokens: tokensChunk,
    };

    try {
      const response = await firebaseMessaging.sendEachForMulticast(message);

      sent += response.successCount;
      failed += response.failureCount;

      // 4. Identify stale/unregistered tokens from response
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === "messaging/registration-token-not-registered" ||
              errorCode === "messaging/invalid-registration-token"
            ) {
              staleDeviceIds.push(deviceChunk[idx].id);
            }
          }
        });
      }

      results.push({
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (fcmError) {
      console.error("[Broadcast] FCM Chunk sending error:", fcmError);
      failed += deviceChunk.length;
    }
  }

  // 5. Cleanup stale tokens in a single query
  if (staleDeviceIds.length > 0) {
    try {
      const placeholders = staleDeviceIds.map(() => "?").join(",");
      await db.execute(
        `UPDATE notification_devices SET is_active = 0 WHERE id IN (${placeholders})`,
        staleDeviceIds,
      );
      console.warn(
        `[Broadcast] Automatically deactivated ${staleDeviceIds.length} stale devices.`,
      );
    } catch (cleanupError) {
      console.error("[Broadcast] Stale token cleanup error:", cleanupError);
    }
  }

  return {
    success: failed === 0,
    totalDevices: devices.length,
    sent,
    failed,
    results,
  };
};

const sendNotificationToAdmins = async ({
  title,
  body,
  type = "ADMIN_ALERT",
  data = {},
}) => {
  const adminDevices = await notificationRepository.getAdminDevices();

  if (!adminDevices.length) {
    return {
      success: true,
      sent: 0,
      failed: 0,
      message: "No active admin devices found",
    };
  }

  const adminUserIds = [...new Set(adminDevices.map((d) => d.user_id))];

  for (const adminId of adminUserIds) {
    try {
      await notificationRepository.createNotification({
        userId: adminId,
        type,
        title,
        body,
        data,
      });
    } catch (err) {
      console.error(
        `Failed to store admin notification for user ${adminId}:`,
        err,
      );
    }
  }

  const results = [];

  for (const device of adminDevices) {
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
      const isUnregistered =
        error.code === "messaging/registration-token-not-registered" ||
        error.errorInfo?.code ===
          "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-registration-token";

      if (isUnregistered) {
        await notificationRepository.deactivateDevice?.(device.installation_id);
      }

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

const sendNotificationToRidePassengers = async ({
  rideId,
  title,
  body,
  type = "SYSTEM",
  data = {},
}) => {
  // 1. Get all active passenger user_ids registered for this ride
  const [passengers] = await db.execute(
    `SELECT DISTINCT passenger_id 
     FROM ride_bookings 
     WHERE ride_id = ? 
       AND status IN ('confirmed', 'accepted', 'ongoing', 'completed')`,
    [rideId],
  );

  if (!passengers.length) {
    return { success: true, count: 0 };
  }

  // 2. Dispatch FCM push notifications concurrently
  const pushPromises = passengers.map((p) =>
    sendNotificationToUser({
      userId: p.passenger_id,
      title,
      body,
      type,
      data: {
        rideId,
        ...data,
      },
    }).catch((err) =>
      console.error(
        `[FCM Ride Passenger Notification Error] Passenger ${p.passenger_id}:`,
        err,
      ),
    ),
  );

  await Promise.all(pushPromises);
  return { success: true, count: passengers.length };
};

module.exports = {
  sendPushNotification,
  sendNotificationToUser,
  sendBroadcast,
  sendNotificationToAdmins,
  sendNotificationToRidePassengers,
};
