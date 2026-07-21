const db = require("../config/db");

class Vehicle {
  static async getByUserId(userId) {
    const sql = `
            SELECT *
            FROM vehicles
            WHERE user_id = ?
            ORDER BY id DESC
        `;
    const [rows] = await db.execute(sql, [userId]);
    return rows;
  }

  static async allVehicleLists() {
    const sql = `
            SELECT *
            FROM vehicles ORDER BY id DESC
        `;

    const [rows] = await db.execute(sql);

    return rows;
  }

  static async getByVehicleId(id) {
    const sql = `
            SELECT *
            FROM vehicles WHERE id = ? LIMIT 1`;

    const [rows] = await db.execute(sql, [id]);

    if (rows.length) {
      rows[0].rc_file = rows[0].rc_file
        ? `${process.env.APP_URL}/uploads/vehicle/${rows[0].rc_file}`
        : "";

      rows[0].insurance_file = rows[0].insurance_file
        ? `${process.env.APP_URL}/uploads/vehicle/${rows[0].insurance_file}`
        : "";

      rows[0].front_image = rows[0].front_image
        ? `${process.env.APP_URL}/uploads/vehicle/${rows[0].front_image}`
        : "";

      rows[0].back_image = rows[0].back_image
        ? `${process.env.APP_URL}/uploads/vehicle/${rows[0].back_image}`
        : "";

      rows[0].side_image = rows[0].side_image
        ? `${process.env.APP_URL}/uploads/vehicle/${rows[0].side_image}`
        : "";

      rows[0].number_plate_image = rows[0].number_plate_image
        ? `${process.env.APP_URL}/uploads/vehicle/${rows[0].number_plate_image}`
        : "";
    }

    return rows.length ? rows[0] : null;
  }

  static async updateStatus(id, status) {
    const [result] = await db.execute(
      "UPDATE vehicles SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = Vehicle;
