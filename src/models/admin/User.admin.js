const db = require("../../config/db");

const DOC_TYPE_MAP = {
  license: "is_dl_verified",
  aadhar: "is_adhhar_verified",
  pan: "is_pan_verified",
  bank: "is_account_verified",
};

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
    const query = `SELECT id, name, email, status, role FROM users WHERE id = ?`;
    const [rows] = await db.execute(query, [userId]);
    return rows[0] || null;
  }

  static async getAllDrivers({
    page = 1,
    limit = 10,
    search = "",
    status = "",
  }) {
    const offset = (page - 1) * limit;
    const searchParam = `%${search}%`;

    let whereClause = `WHERE u.role = 2 AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
    const queryParams = [searchParam, searchParam, searchParam];

    if (status) {
      whereClause += ` AND u.status = ?`;
      queryParams.push(status);
    }

    // Count Total Drivers
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users u
      ${whereClause}
    `;

    // Fetch Drivers with stats
    const dataQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.created_at,
        u.updated_at,
        COUNT(DISTINCT v.id) AS total_vehicles,
        COUNT(DISTINCT r.id) AS total_rides
      FROM users u
      LEFT JOIN vehicles v ON v.user_id = u.id
      LEFT JOIN rides r ON r.driver_id = u.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [[{ total }]] = await db.execute(countQuery, queryParams);

    // Add limit & offset as strings/numbers to query params
    const [drivers] = await db.execute(dataQuery, [
      ...queryParams,
      String(limit),
      String(offset),
    ]);

    return { total, drivers };
  }

  static async getPendingDrivers({ page = 1, limit = 10, search = "" }) {
    const offset = (page - 1) * limit;
    const searchParam = `%${search}%`;

    // Filter specifically for pending drivers (role = 2 AND status = 'pending')
    let whereClause = `WHERE u.role = 2 AND u.status = 'pending' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
    const queryParams = [searchParam, searchParam, searchParam];

    // Count Total Pending Drivers
    const countQuery = `
    SELECT COUNT(*) as total 
    FROM users u
    ${whereClause}
  `;

    // Fetch Drivers with user_details document fields
    const dataQuery = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.status,
      u.created_at,
      u.updated_at,
      ud.driver_license,
      ud.is_dl_verified,
      ud.adhhar_card,
      ud.is_adhhar_verified,
      ud.pan_card,
      ud.is_pan_verified,
      ud.bank_account,
      ud.is_account_verified,
      COUNT(DISTINCT v.id) AS total_vehicles,
      COUNT(DISTINCT r.id) AS total_rides
    FROM users u
    LEFT JOIN user_details ud ON ud.user_id = u.id
    LEFT JOIN vehicles v ON v.user_id = u.id
    LEFT JOIN rides r ON r.driver_id = u.id
    ${whereClause}
    GROUP BY 
      u.id, 
      u.name, 
      u.email, 
      u.phone, 
      u.status, 
      u.created_at, 
      u.updated_at, 
      ud.driver_license, 
      ud.is_dl_verified, 
      ud.adhhar_card, 
      ud.is_adhhar_verified, 
      ud.pan_card, 
      ud.is_pan_verified, 
      ud.bank_account, 
      ud.is_account_verified
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `;

    const [[{ total }]] = await db.execute(countQuery, queryParams);

    const [rows] = await db.execute(dataQuery, [
      ...queryParams,
      String(limit),
      String(offset),
    ]);

    // Format flat document columns into the array required by the frontend
    const drivers = rows.map((driver) => {
      const documents = [];

      // 1. Driving License
      if (driver.driver_license) {
        documents.push({
          id: `license-${driver.id}`,
          name: "Driving License",
          type: "license",
          url: driver.driver_license,
          status: driver.is_dl_verified || "pending",
        });
      }

      // 2. National ID
      if (driver.adhhar_card) {
        documents.push({
          id: `aadhar-${driver.id}`,
          name: "Aadhaar Card",
          type: "aadhar",
          url: driver.adhhar_card,
          status: driver.is_adhhar_verified || "pending",
        });
      }

      // 3. Tax / Identity Card
      if (driver.pan_card) {
        documents.push({
          id: `pan-${driver.id}`,
          name: "PAN Card",
          type: "pan",
          url: driver.pan_card,
          status: driver.is_pan_verified || "pending",
        });
      }

      // 4. Bank Account Document
      if (driver.bank_account) {
        documents.push({
          id: `bank-${driver.id}`,
          name: "Bank Proof",
          type: "bank",
          url: driver.bank_account,
          status: driver.is_account_verified || "pending",
        });
      }

      // Remove raw SQL document properties to keep response clean
      delete driver.driver_license;
      delete driver.is_dl_verified;
      delete driver.adhhar_card;
      delete driver.is_adhhar_verified;
      delete driver.pan_card;
      delete driver.is_pan_verified;
      delete driver.bank_account;
      delete driver.is_account_verified;

      return {
        ...driver,
        documents,
      };
    });

    return { total, drivers };
  }

  static async getDriverById(driverId) {
    const driverQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.id = ? AND u.role = 2
    `;

    const vehiclesQuery = `
      SELECT id, model, registration_number, fuel_type, color, status 
      FROM vehicles 
      WHERE user_id = ?
    `;

    const [driverRows] = await db.execute(driverQuery, [driverId]);
    if (!driverRows[0]) return null;

    const [vehicles] = await db.execute(vehiclesQuery, [driverId]);

    return {
      ...driverRows[0],
      vehicles,
    };
  }

  static async updateDocumentStatus(userId, docType, status) {
    const column = DOC_TYPE_MAP[docType];
    if (!column) {
      throw new Error(`Invalid document type: ${docType}`);
    }

    const query = `
      UPDATE user_details 
      SET ${column} = ?, updated_at = NOW() 
      WHERE user_id = ?
    `;

    const [result] = await db.query(query, [status, userId]);
    return result;
  }

  /**
   * Check verification statuses across all documents for a user
   */
  static async getVerificationState(userId) {
    const query = `
      SELECT 
        is_dl_verified, 
        is_adhhar_verified, 
        is_pan_verified, 
        is_account_verified,
        status,
        is_verified
      FROM user_details 
      WHERE user_id = ?
    `;
    const [rows] = await db.query(query, [userId]);
    return rows[0] || null;
  }

  /**
   * Update overall driver approval status
   */
  static async updateDriverOverallStatus(userId, { status, isVerified }) {
    const query = `
      UPDATE user_details 
      SET 
        status = ?, 
        is_verified = ?, 
        updated_at = NOW() 
      WHERE user_id = ?
    `;
    const [result] = await db.query(query, [status, isVerified, userId]);
    return result;
  }
}

module.exports = UserManagement;
