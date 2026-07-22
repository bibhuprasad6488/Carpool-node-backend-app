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

  static async createVehicle(vehicleData) {
    const connection = await db.getConnection();

    try {
      // 1. Check duplicate Registration Number
      const [existingReg] = await connection.query(
        "SELECT id FROM vehicles WHERE registration_number = ? LIMIT 1",
        [vehicleData.registration_number],
      );
      if (existingReg.length > 0) {
        throw {
          statusCode: 422,
          message: "Registration number already exists.",
        };
      }

      // 2. Check duplicate RC Number
      const [existingRc] = await connection.query(
        "SELECT id FROM vehicles WHERE rc_number = ? LIMIT 1",
        [vehicleData.rc_number],
      );
      if (existingRc.length > 0) {
        throw { statusCode: 422, message: "RC Number already exists." };
      }

      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO vehicles
        (
            user_id, vehicle_type, brand, model, manufacture_year,
            registration_number, color, seats, available_seats, fuel_type,
            rc_number, rc_expiry_date, insurance_provider, policy_number,
            insurance_expiry, rc_file, insurance_file, front_image,
            back_image, side_image, number_plate_image, status, created_at, updated_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [
          vehicleData.user_id,
          vehicleData.vehicle_type || "Car",
          vehicleData.brand,
          vehicleData.model,
          vehicleData.manufacture_year,
          vehicleData.registration_number,
          vehicleData.color,
          vehicleData.seats,
          vehicleData.available_seats || vehicleData.seats,
          vehicleData.fuel_type,
          vehicleData.rc_number,
          vehicleData.rc_expiry_date || null,
          vehicleData.insurance_provider || null,
          vehicleData.policy_number || null,
          vehicleData.insurance_expiry || null,
          vehicleData.rc_file,
          vehicleData.insurance_file,
          vehicleData.front_image,
          vehicleData.back_image,
          vehicleData.side_image,
          vehicleData.number_plate_image,
        ],
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
