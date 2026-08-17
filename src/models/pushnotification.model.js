const db = require("../config/db");

const registerDevice = async ({
  userId,
  installationId,
  pushToken,
  platform,
}) => {
  // Prevent the same FCM token from being active
  // on another installation.
  await db.execute(
    `
      UPDATE notification_devices
      SET is_active = 0,
          updated_at = NOW()
      WHERE push_token = ?
        AND installation_id != ?
    `,
    [pushToken, installationId],
  );

  const [existing] = await db.execute(
    `
      SELECT id
      FROM notification_devices
      WHERE installation_id = ?
      LIMIT 1
    `,
    [installationId],
  );

  if (existing.length) {
    await db.execute(
      `
        UPDATE notification_devices
        SET
          user_id = ?,
          push_token = ?,
          platform = ?,
          is_active = 1,
          updated_at = NOW()
        WHERE installation_id = ?
      `,
      [userId, pushToken, platform, installationId],
    );

    return {
      id: existing[0].id,
      userId,
      installationId,
      updated: true,
    };
  }

  const [result] = await db.execute(
    `
      INSERT INTO notification_devices
      (
        user_id,
        installation_id,
        push_token,
        platform,
        is_active
      )
      VALUES (?, ?, ?, ?, 1)
    `,
    [userId, installationId, pushToken, platform],
  );

  return {
    id: result.insertId,
    userId,
    installationId,
    created: true,
  };
};

const getDevicesByUserId = async (userId) => {
  const [rows] = await db.execute(
    `
      SELECT *
      FROM notification_devices
      WHERE user_id = ?
        AND is_active = TRUE
    `,
    [userId],
  );

  return rows;
};

const getActiveDevicesByUserId = async (userId) => {
  const [rows] = await db.execute(
    `
        SELECT
            id,
            user_id,
            installation_id,
            push_token,
            platform,
            device_type,
            browser,
            app_version
        FROM notification_devices
        WHERE user_id = ?
          AND is_active = TRUE
          AND push_token IS NOT NULL
          AND push_token != ''
        `,
    [userId],
  );

  return rows;
};

const deactivateDevice = async (installationId) => {
  const [result] = await db.execute(
    `
      UPDATE notification_devices
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE installation_id = ?
    `,
    [installationId],
  );

  return result;
};

const createNotification = async ({ userId, type, title, body, data = {} }) => {
  const [result] = await db.execute(
    `
        INSERT INTO notifications (
            user_id,
            type,
            title,
            body,
            data
        )
        VALUES (?, ?, ?, ?, ?)
        `,
    [userId, type, title, body, JSON.stringify(data)],
  );

  return result.insertId;
};

module.exports = {
  registerDevice,
  getDevicesByUserId,
  getActiveDevicesByUserId,
  deactivateDevice,
  createNotification,
};
