// src/models/admin/Vehicle.admin.js
const db = require('../../config/db'); // Adjust path to your database config

class VehicleAdminModel {
  static async getAllVehicles({ page = 1, limit = 10, search = '' }) {
    const offset = (page - 1) * limit;
    const searchParam = `%${search}%`;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM vehicles v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.model LIKE ? OR v.registration_number LIKE ? OR u.name LIKE ?
    `;

    const dataQuery = `
      SELECT 
        v.id,
        v.user_id AS driver_id,
        u.name AS driver_name,
        u.email AS driver_email,
        u.phone AS driver_phone,
        v.model,
        v.registration_number,
        v.fuel_type,
        v.color,
        v.status,
        v.created_at,
        v.updated_at
      FROM vehicles v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.model LIKE ? OR v.registration_number LIKE ? OR u.name LIKE ?
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [[{ total }]] = await db.execute(countQuery, [searchParam, searchParam, searchParam]);
    const [vehicles] = await db.execute(dataQuery, [
      searchParam, 
      searchParam, 
      searchParam, 
      String(limit), 
      String(offset)
    ]);

    return { total, vehicles };
  }

  static async getVehicleById(id) {
    const query = `
      SELECT 
        v.*,
        u.name AS driver_name,
        u.email AS driver_email,
        u.phone AS driver_phone
      FROM vehicles v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
  }

  static async updateStatus(id, status) {
    const query = `
      UPDATE vehicles 
      SET status = ?, updated_at = NOW() 
      WHERE id = ?
    `;
    const [result] = await db.execute(query, [status, id]);
    return result;
  }


  static async deleteVehicle(id) {
    const query = `DELETE FROM vehicles WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
  }
}

module.exports = VehicleAdminModel;