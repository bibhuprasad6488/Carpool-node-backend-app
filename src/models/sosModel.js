const db = require("../config/db");

class SosModel {
  static async createLog(
    connection,
    { rideId, userId, userType, latitude, longitude },
  ) {
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
