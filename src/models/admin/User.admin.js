const db = require("../../config/db");

class UserManagement {
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

      const stats = rows[0] || {};

      return {
        totalUsers: Number(stats.totalUsers || 0),
        verifiedAccounts: Number(stats.verifiedAccounts || 0),
        pendingApproval: Number(stats.pendingApproval || 0),
        suspendedUsers: Number(stats.suspendedUsers || 0),
      };
    } catch (error) {
      console.error("Error fetching user stats:", error);
      return {
        totalUsers: 0,
        verifiedAccounts: 0,
        pendingApproval: 0,
        suspendedUsers: 0,
      };
    }
  }

  static async getAdminUsersList({
    search,
    role,
    status,
    limit = 10,
    offset = 0,
  }) {
    try {
      let query = `
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.phone,
          u.role, 
          u.status,
          u.is_verified,
          u.created_at,
          ud.city,
          ud.state,
          ud.profile_picture,
          ud.is_dl_verified,
          ud.is_adhhar_verified,
          ud.is_pan_verified,
          ud.is_account_verified,
          ud.status AS kyc_status
        FROM users u
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE 1=1
      `;

      const params = [];

      // 1. Search Filter (Name, Email, Phone, or ID)
      if (search && search.trim() !== "") {
        const searchTerm = `%${search.trim()}%`;
        query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR CAST(u.id AS CHAR) LIKE ?)`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // 2. Role Filter
      if (role && role !== "all") {
        query += ` AND u.role = ?`;
        params.push(role);
      }

      // 3. Status Filter
      if (status && status !== "all") {
        const statusLower = status.toLowerCase();
        if (statusLower === "verified") {
          query += ` AND u.is_verified = 1 AND u.status = 'active'`;
        } else if (statusLower === "pending") {
          query += ` AND (u.is_verified = 0 OR u.is_verified IS NULL)`;
        } else if (statusLower === "suspended") {
          query += ` AND u.status = 'suspended'`;
        } else {
          query += ` AND u.status = ?`;
          params.push(status);
        }
      }

      // 4. Ordering & Pagination
      query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
      params.push(String(Number(limit)), String(Number(offset)));

      const [rows] = await db.execute(query, params);
      return rows || [];
    } catch (error) {
      console.error("Error fetching admin users list:", error);
      throw error;
    }
  }

  static async getFullUserDetails(userId) {
    try {
      const [rows] = await db.execute(
        `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.is_verified,
          u.email_verified_at,
          u.created_at,
          u.updated_at,
          ud.city,
          ud.state,
          ud.country,
          ud.postal_code,
          ud.address,
          ud.driver_license,
          ud.is_dl_verified,
          ud.adhhar_card,
          ud.is_adhhar_verified,
          ud.pan_card,
          ud.is_pan_verified,
          ud.bank_account,
          ud.is_account_verified,
          ud.bank_account_holder,
          ud.bank_account_number,
          ud.bank_account_ifsc,
          ud.bank_name,
          ud.profile_picture,
          ud.is_verified AS details_is_verified,
          ud.status AS details_status
        FROM users u
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE u.id = ?
        LIMIT 1
      `,
        [userId],
      );

      return rows[0] || null;
    } catch (error) {
      console.error(`Error fetching user details for ID ${userId}:`, error);
      throw error;
    }
  }

  static async updateUserStatus(userId, status) {
    const query = `
      UPDATE users 
      SET status = ?, updated_at = NOW() 
      WHERE id = ?
    `;
    const [result] = await db.execute(query, [status, userId]);
    return result;
  }

  static async findById(userId) {
    const query = `SELECT id, name, email, status FROM users WHERE id = ?`;
    const [rows] = await db.execute(query, [userId]);
    return rows[0] || null;
  }
}

module.exports = UserManagement;
