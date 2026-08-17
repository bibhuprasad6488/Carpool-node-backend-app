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
      last_registered_at = NOW(),
      last_seen_at = NOW(),
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

const getAllDevices = async ({
  page = 1,
  limit = 20,
  search = "",
  platform,
  isActive,
}) => {
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(`
      (
        CAST(nd.user_id AS CHAR) LIKE ?
        OR nd.installation_id LIKE ?
        OR nd.push_token LIKE ?
        OR nd.browser LIKE ?
      )
    `);

    const searchValue = `%${search}%`;

    params.push(searchValue, searchValue, searchValue, searchValue);
  }

  if (platform) {
    conditions.push("nd.platform = ?");
    params.push(platform);
  }

  if (isActive !== undefined) {
    conditions.push("nd.is_active = ?");
    params.push(isActive);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await db.execute(
    `
      SELECT
        nd.id,
        nd.user_id,
        nd.installation_id,
        nd.platform,
        nd.device_type,
        nd.browser,
        nd.app_version,
        nd.permission_status,
        nd.is_active,
        nd.last_registered_at,
        nd.last_seen_at,
        nd.created_at,
        nd.updated_at
      FROM notification_devices nd
      ${whereClause}
      ORDER BY nd.updated_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  );

  const [[countResult]] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM notification_devices nd
      ${whereClause}
    `,
    params,
  );

  return {
    items: rows,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  };
};

const getDeviceById = async (id) => {
  const [rows] = await db.execute(
    `
      SELECT
        id,
        user_id,
        installation_id,
        platform,
        device_type,
        browser,
        app_version,
        permission_status,
        is_active,
        last_registered_at,
        last_seen_at,
        created_at,
        updated_at
      FROM notification_devices
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
};

const getAllNotifications = async ({
  page = 1,
  limit = 20,
  type,
  userId,
  isRead,
}) => {
  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (type) {
    conditions.push("n.type = ?");
    params.push(type);
  }

  if (userId) {
    conditions.push("n.user_id = ?");
    params.push(userId);
  }

  if (isRead !== undefined && isRead !== "") {
    conditions.push("n.is_read = ?");
    params.push(Number(isRead));
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // IMPORTANT:
  // LIMIT/OFFSET are inserted after validation instead
  // of being passed as prepared-statement parameters.
  const [rows] = await db.execute(
    `
      SELECT
        n.id,
        n.user_id,
        n.type,
        n.title,
        n.body,
        n.data,
        n.is_read,
        n.read_at,
        n.created_at
      FROM notifications n
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    params,
  );

  const [[countResult]] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM notifications n
      ${whereClause}
    `,
    params,
  );

  return {
    items: rows,
    pagination: {
      page,
      limit,
      total: Number(countResult.total),
      totalPages: Math.ceil(Number(countResult.total) / limit),
    },
  };
};

const getNotificationById = async (id) => {
  const [rows] = await db.execute(
    `
      SELECT *
      FROM notifications
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
};

const getNotificationStats = async () => {
  const [[deviceStats]] = await db.execute(`
    SELECT
      COUNT(*) AS total_devices,

      COALESCE(
        SUM(
          CASE
            WHEN is_active = 1 THEN 1
            ELSE 0
          END
        ),
        0
      ) AS active_devices,

      COALESCE(
        SUM(
          CASE
            WHEN platform = 'web' THEN 1
            ELSE 0
          END
        ),
        0
      ) AS web_devices,

      COALESCE(
        SUM(
          CASE
            WHEN platform = 'android' THEN 1
            ELSE 0
          END
        ),
        0
      ) AS android_devices,

      COALESCE(
        SUM(
          CASE
            WHEN platform = 'ios' THEN 1
            ELSE 0
          END
        ),
        0
      ) AS ios_devices

    FROM notification_devices
  `);

  const [[notificationStats]] = await db.execute(`
    SELECT
      COUNT(*) AS total_notifications
    FROM notifications
  `);

  return {
    devices: deviceStats,
    notifications: notificationStats,
  };
};

module.exports = {
  registerDevice,
  getDevicesByUserId,
  getActiveDevicesByUserId,
  deactivateDevice,
  createNotification,
  getAllDevices,
  getDeviceById,
  getNotificationById,
  getAllNotifications,
  getNotificationStats,
};
