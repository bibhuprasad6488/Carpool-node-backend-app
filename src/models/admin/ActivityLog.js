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
    const query = `
            INSERT INTO activity_logs 
            (user_id, action, description, entity_type, entity_id, ip_address, user_agent, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
    ];

    const [result] = await db.execute(query, values);
    return result.insertId;
  }

  static async getAllActivityLogs({
    page = 1,
    limit = 20,
    search = "",
    action = "",
  } = {}) {
    const offset = (page - 1) * limit;
    let whereClauses = [];
    let params = [];

    if (action) {
      whereClauses.push("al.action = ?");
      params.push(action);
    }

    if (search) {
      whereClauses.push(
        "(al.description LIKE ? OR u.name LIKE ? OR u.email LIKE ?)",
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
            SELECT 
                al.*,
                u.name AS user_name,
                u.email AS user_email,
                r.name AS role_name
            FROM activity_logs al
            LEFT JOIN users u ON u.id = al.user_id
            LEFT JOIN roles r ON r.id = u.role
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

    const [logs] = await db.query(query, [
      ...params,
      Number(limit),
      Number(offset),
    ]);
    const [[{ total }]] = await db.query(countQuery, params);

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = ActivityLog;
