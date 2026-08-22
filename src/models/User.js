// src/models/User.js

const db = require("../config/db");

class User {
  static async getAll() {
    const [users] = await db.query("SELECT * FROM users");

    return users;
  }

  static async findById(id) {
    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    return users[0];
  }

  static async create(data) {
    const { name, email } = data;
    await db.query("SET time_zone = '+05:30'");

    const [result] = await db.query(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [name, email],
    );
    return result.insertId;
  }

  static async findByEmail(email) {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    return rows[0];
  }

  static async getAdminProfileById(userId) {
    const [rows] = await db.execute(
      "SELECT id, name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    return rows[0] || null;
  }

  static async updateLastLogin(userId) {
    await db.execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
      userId,
    ]);
  }

  static async getUserDetailsById(id, connection = db) {
    const sql = `
        SELECT *
        FROM user_details
        WHERE user_id = ?
        LIMIT 1
    `;

    const [rows] = await connection.execute(sql, [id]);
    if (rows.length) {
      const details = rows[0];
      return details;
    }

    return null;
  }

  static async getUserWithDetails(id) {
    const [userRows] = await db.query(
      `SELECT
                u.id,
                u.name,
                u.email,
                u.phone,
                u.role,
                u.is_verified,
                ud.city,
                ud.state,
                ud.country,
                ud.postal_code,
                ud.address,
                ud.bank_account_holder,
                ud.bank_account_number,
                ud.bank_account_ifsc,
                ud.bank_name,
                ud.driver_license,
                ud.adhhar_card,
                ud.pan_card,
                ud.bank_account,
                ud.profile_picture,
                ud.status
            FROM users u
            LEFT JOIN user_details ud
                ON ud.user_id = u.id
            WHERE u.id = ?`,
      [id],
    );

    if (userRows.length) {
      const details = userRows[0];
      return details;
    }

    return null;
  }

  static async updateUser(connection, userId, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;

    const setClause = keys.map((key) => `\`${key}\` = ?`).join(", ");
    const values = Object.values(fields);
    await connection.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      [...values, userId],
    );
  }

  static async upsertUserDetails(connection, userId, detailsFields) {
    const existingDetails = await this.getUserDetailsById(userId, connection);

    if (existingDetails) {
      const keys = Object.keys(detailsFields);
      if (keys.length === 0) return;

      const setClause = keys.map((key) => `\`${key}\` = ?`).join(", ");
      const values = Object.values(detailsFields);

      await connection.query(
        `UPDATE user_details SET ${setClause}, updated_at = NOW() WHERE user_id = ?`,
        [...values, userId],
      );
    } else {
      const fieldsToInsert = { user_id: userId, ...detailsFields };
      const keys = Object.keys(fieldsToInsert);
      const escapedKeys = keys.map((key) => `\`${key}\``).join(", ");
      const placeholders = keys.map(() => "?").join(", ");
      const values = Object.values(fieldsToInsert);

      await connection.query(
        `INSERT INTO user_details (${escapedKeys}, created_at, updated_at) 
       VALUES (${placeholders}, NOW(), NOW())`,
        values,
      );
    }
  }
}

module.exports = User;
