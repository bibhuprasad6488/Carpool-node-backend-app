const db = require("../config/db");

class SosModel {
  static async createLog(
    connection,
    { rideId, userId, userType, latitude, longitude },
  ) {
    await connection.query("SET time_zone = '+05:30'");

    const query = `
      INSERT INTO sos_logs (ride_id, user_id, user_type, latitude, longitude, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const [result] = await connection.query(query, [
      rideId,
      userId,
      userType,
      latitude,
      longitude,
    ]);
    return result.insertId;
  }

  static async findById(sosId) {
    const query = `
      SELECT s.*, u.name as user_name, u.phone as user_phone 
      FROM sos_logs s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `;
    const [rows] = await db.query(query, [sosId]);
    return rows[0];
  }

  static async getAll({ status, page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT s.*, 
             u.name as user_name, u.phone as user_phone,
             admin.name as resolved_by_name,
             r.ride_date, r.departure_time, r.source_address, r.destination_address
      FROM sos_logs s
      JOIN users u ON s.user_id = u.id
      JOIN rides r ON s.ride_id = r.id
      LEFT JOIN users admin ON s.resolved_by = admin.id
    `;
    const queryParams = [];

    if (status) {
      query += ` WHERE s.status = ?`;
      queryParams.push(status);
    }

    query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(Number(limit), Number(offset));

    const [rows] = await db.query(query, queryParams);

    // Get total count for pagination headers/metadata
    let countQuery = `SELECT COUNT(*) as total FROM sos_logs s`;
    const countParams = [];
    if (status) {
      countQuery += ` WHERE s.status = ?`;
      countParams.push(status);
    }
    const [countResult] = await db.query(countQuery, countParams);
    const totalRecords = countResult[0].total;

    return {
      data: rows,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    };
  }

  static async updateStatus(sosId, status, resolvedBy, notes) {
    const query = `
      UPDATE sos_logs 
      SET status = ?, resolved_by = ?, resolution_notes = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const [result] = await db.query(query, [status, resolvedBy, notes, sosId]);
    return result;
  }
}

module.exports = SosModel;
