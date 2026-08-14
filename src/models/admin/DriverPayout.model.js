// models/DriverPayout.js
const db = require("../../config/db");

class DriverPayout {
  // Create pending payout record
  static async create(payoutData) {
    const {
      payoutCode,
      rideId,
      driverId,
      grossAmount,
      platformFee,
      netPayoutAmount,
      accountNumber,
      ifscCode,
    } = payoutData;

    const query = `
      INSERT INTO driver_payouts 
        (payout_code, ride_id, driver_id, gross_amount, platform_fee, net_payout_amount, account_number, ifsc_code, status, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
    `;

    const [result] = await db.query(query, [
      payoutCode,
      rideId,
      driverId,
      grossAmount,
      platformFee,
      netPayoutAmount,
      accountNumber,
      ifscCode,
    ]);

    return result.insertId;
  }

  // Find payout by ID with transaction lock support
  static async findById(payoutId, connection = null) {
    const queryExecutor = connection || db;
    const query = `
      SELECT dp.*, u.name AS driver_name, u.phone AS driver_phone
      FROM driver_payouts dp
      INNER JOIN users u ON dp.driver_id = u.id
      WHERE dp.id = ? ${connection ? "FOR UPDATE" : ""}
    `;
    const [rows] = await queryExecutor.query(query, [payoutId]);
    return rows[0] || null;
  }

  // Find payout by Ride ID
  static async findByRideId(rideId) {
    const query = `SELECT * FROM driver_payouts WHERE ride_id = ? LIMIT 1`;
    const [rows] = await db.query(query, [rideId]);
    return rows[0] || null;
  }

  // Get all payouts with pagination & optional status filter (For Admin List)
  static async getAllPaginated(page = 1, limit = 10, status = null) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "";
    const queryParams = [];

    if (status) {
      whereClause = "WHERE dp.status = ?";
      queryParams.push(status);
    }

    const dataQuery = `
      SELECT 
        dp.*,
        u.name AS driver_name,
        u.phone AS driver_phone,
        r.source_address,
        r.destination_address,
        r.ride_date
      FROM driver_payouts dp
      INNER JOIN users u ON dp.driver_id = u.id
      INNER JOIN rides r ON dp.ride_id = r.id
      ${whereClause}
      ORDER BY dp.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM driver_payouts dp
      ${whereClause}
    `;

    const [rows] = await db.query(dataQuery, [...queryParams, limitNum, offset]);
    const [countResult] = await db.query(countQuery, queryParams);

    const total = countResult[0]?.total || 0;

    return {
      payouts: rows,
      pagination: {
        totalRecords: total,
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    };
  }

  // Update status & payout gateway metadata
  static async updateStatus(payoutId, status, payoutIdGateway = null, failureReason = null, connection = null) {
    const queryExecutor = connection || db;
    const query = `
      UPDATE driver_payouts 
      SET status = ?, 
          payout_id = COALESCE(?, payout_id), 
          failure_reason = ?,
          processed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE processed_at END,
          updated_at = NOW() 
      WHERE id = ?
    `;

    const [result] = await queryExecutor.query(query, [
      status,
      payoutIdGateway,
      failureReason,
      status,
      payoutId,
    ]);

    return result.affectedRows > 0;
  }
}

module.exports = DriverPayout;