// src/models/User.js

const db = require("../config/db");
const APP_URL = process.env.APP_URL;
const uploadPathUrl = `${APP_URL}/uploads/user/`;

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

      // Helper to format URLs without double-prefixing Cloudinary links
      const formatUrl = (filePath) => {
        if (!filePath) return "";
        if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
          return filePath;
        }
        return `${APP_URL}/uploads/user/${filePath}`;
      };

      details.profile_picture = formatUrl(details.profile_picture);
      details.driver_license = formatUrl(details.driver_license);
      details.adhhar_card = formatUrl(details.adhhar_card);
      details.pan_card = formatUrl(details.pan_card);
      details.bank_account = formatUrl(details.bank_account);

      return details;
    }

    return null;
  }
}

module.exports = User;
