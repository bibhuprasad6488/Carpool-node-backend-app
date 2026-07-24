// src/models/User.js

const db = require("../config/db");
const APP_URL = process.env.APP_URL;

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

  static async getUserDetailsById(id) {
    const sql = `
        SELECT *
        FROM user_details
        WHERE user_id = ?
        LIMIT 1
    `;

    const [rows] = await db.execute(sql, [id]);

    if (rows.length) {
      const details = rows[0];
      console.log(details);
      return details;
    }

    return null;
  }

  static async getUserStats() {
    try {
      const [rows] = await db.execute(`
        SELECT 
          COUNT(id) AS totalUsers,
          SUM(CASE WHEN status = 'active' AND is_verified = 1 THEN 1 ELSE 0 END) AS verifiedAccounts,
          SUM(CASE WHEN is_verified = 0 OR is_verified IS NULL THEN 1 ELSE 0 END) AS pendingApproval,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspendedUsers
        FROM users
      `);
      return (
        rows[0] || {
          totalUsers: 0,
          verifiedAccounts: 0,
          pendingApproval: 0,
          suspendedUsers: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching user stats:", error);
      // Fallback object to prevent application failure
      return {
        totalUsers: 0,
        verifiedAccounts: 0,
        pendingApproval: 0,
        suspendedUsers: 0,
      };
    }
  }

  static async getUserStats() {
    try {
      const [rows] = await db.execute(`
        SELECT 
          COUNT(id) AS totalUsers,
          SUM(CASE WHEN status = 'active' AND is_verified = 1 THEN 1 ELSE 0 END) AS verifiedAccounts,
          SUM(CASE WHEN is_verified = 0 OR is_verified IS NULL THEN 1 ELSE 0 END) AS pendingApproval,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspendedUsers
        FROM users
      `);
      return rows[0] || { totalUsers: 0, verifiedAccounts: 0, pendingApproval: 0, suspendedUsers: 0 };
    } catch (error) {
      console.error("Error fetching user stats:", error);
      return { totalUsers: 0, verifiedAccounts: 0, pendingApproval: 0, suspendedUsers: 0 };
    }
  }
}

module.exports = User;
