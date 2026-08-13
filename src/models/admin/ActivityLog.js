const db = require("../../config/db");

class ActivityLog {
  static async create({
    user_id = null,
    action,
    description = null,
    entity_type = null,
    entity_id = null,
    ip_address = null,
    user_agent = null,
    status = "success",
  }) {
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    const query = `
    INSERT INTO activity_logs 
    (user_id, action, description, entity_type, entity_id, ip_address, user_agent, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const values = [
      user_id,
      action,
      description,
      entity_type,
      entity_id,
      ip_address,
      user_agent,
      status,
      createdAt,
    ];

    const [result] = await db.execute(query, values);
    return result.insertId;
  }

  static async getLogById(id) {
    const query = `
    SELECT 
      al.id,
      al.user_id,
      al.action,
      al.description,
      al.entity_type,
      al.entity_id,
      al.ip_address,
      al.user_agent,
      al.status,
      al.created_at, 
      
      u.name AS user_name,
      u.email AS user_email,
      u.role AS role_name
    FROM activity_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.id = ?
    LIMIT 1
  `;

    const [rows] = await db.query(query, [id]);

    return rows.length > 0 ? rows[0] : null;
  }

  static async getAllActivityLogs({
    page = 1,
    limit = 20,
    search = "",
    action = "",
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    if (action) {
      whereClauses.push("al.action = ?");
      params.push(action);
    }

    if (search) {
      whereClauses.push(
        "(al.description LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)",
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Changed ORDER BY al.created_at to DESC for most recent first
    const query = `
      SELECT 
          al.id,
          al.user_id,
          al.action,
          al.description,
          al.entity_type,
          al.entity_id,
          al.ip_address,
          al.user_agent,
          al.status AS log_status,
          al.created_at AS created_at,
          
          -- User Details
          u.name AS user_name,
          u.email AS user_email,
          u.phone AS user_phone,
          u.role AS user_role,
          u.status AS user_status,
          
          -- Additional User Profile Info
          ud.profile_picture,
          ud.city,
          ud.state
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN user_details ud ON ud.user_id = u.id
      ${whereSql}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
  `;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereSql}
  `;

    const [logs] = await db.query(query, [...params, limitNum, offset]);
    const [[{ total }]] = await db.query(countQuery, params);

    return {
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  static async clearAllLogs() {
  const query = `TRUNCATE TABLE activity_logs`;
  const [result] = await db.query(query);
  return result;
}
}

module.exports = ActivityLog;
