const db = require("../../config/db");

class RideManagement {
  static async getAll(travelDate = null) {
    let sql = `SELECT
    r.id,
    r.source_address,
    r.destination_address,
    r.price_per_seat,
    r.status,
    r.total_seats,
    r.available_seats,
    r.ride_date,
    r.departure_time,

    u.id AS driver_id,
    u.name AS driver_name,
    u.email AS driver_email,
    u.phone AS driver_phone,

    v.id AS vehicle_id,
    v.model,
    v.registration_number,
    v.fuel_type

FROM rides r

LEFT JOIN users u
    ON u.id = r.driver_id

LEFT JOIN vehicles v
    ON v.id = r.vehicle_id`;

    const params = [];

    if (travelDate) {
      sql += ` WHERE r.ride_date = ?`;
      params.push(travelDate);
    }
    sql += ` ORDER BY r.id DESC`;
    const [rows] = await db.execute(sql, params);
    return rows;
  }

  static async getRideByIdForAdmin(rideId) {
    const sql = `
      SELECT
        -- All Ride Table Details
        r.id,
        r.driver_id,
        r.vehicle_id,
        r.source_address,
        r.source_place_id,
        r.destination_address,
        r.destination_place_id,
        r.source_lat,
        r.source_lng,
        r.destination_lat,
        r.destination_lng,
        r.ride_date,
        r.departure_time,
        r.polyline,
        r.distance_meters,
        r.duration_seconds,
        r.estimated_reach_time,
        r.pet_allowed,
        r.smoking_allowed,
        r.instant_booking,
        r.max_two_in_back,
        r.price_per_seat,
        r.total_seats,
        r.available_seats,
        r.status,
        r.created_at,
        r.updated_at,

        -- Basic Driver Info
        u.name AS driver_name,
        u.email AS driver_email,
        u.phone AS driver_phone,


        -- Basic Vehicle Info
        v.model AS vehicle_model,
        v.registration_number AS vehicle_registration_number,
        v.fuel_type AS vehicle_fuel_type,
        v.color AS vehicle_color

      FROM rides r
      LEFT JOIN users u 
        ON u.id = r.driver_id
      LEFT JOIN vehicles v 
        ON v.id = r.vehicle_id
      WHERE r.id = ?
    `;

    const [rows] = await db.query(sql, [rideId]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const ride = rows[0];

    // Safely parse JSON if route_points is stored as a JSON string in MySQL
    if (ride.route_points && typeof ride.route_points === "string") {
      try {
        ride.route_points = JSON.parse(ride.route_points);
      } catch (err) {
        console.error("Failed to parse route_points JSON:", err);
      }
    }

    return ride;
  }

  static async createRide(rideData) {
    const {
      driver_id,
      vehicle_id,
      source_address,
      source_place_id,
      destination_address,
      destination_place_id,
      source_lat,
      source_lng,
      destination_lat,
      destination_lng,
      ride_date,
      departure_time,
      polyline,
      route_points,
      distance_meters,
      duration_seconds,
      estimated_reach_time,
      pet_allowed = "no",
      smoking_allowed = "no",
      instant_booking = "no",
      max_two_in_back = "no",
      price_per_seat,
      total_seats,
      available_seats,
      status = "scheduled",
    } = rideData;

    const routePointsJson = route_points
      ? typeof route_points === "string"
        ? route_points
        : JSON.stringify(route_points)
      : null;

    const sql = `
      INSERT INTO rides (
        driver_id, vehicle_id, source_address, source_place_id,
        destination_address, destination_place_id, source_lat, source_lng,
        destination_lat, destination_lng, ride_date, departure_time,
        polyline, route_points, distance_meters, duration_seconds,
        estimated_reach_time, pet_allowed, smoking_allowed, instant_booking,
        max_two_in_back, price_per_seat, total_seats, available_seats, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      driver_id,
      vehicle_id,
      source_address,
      source_place_id,
      destination_address,
      destination_place_id,
      source_lat,
      source_lng,
      destination_lat,
      destination_lng,
      ride_date,
      departure_time,
      polyline,
      routePointsJson,
      distance_meters,
      duration_seconds,
      estimated_reach_time,
      pet_allowed,
      smoking_allowed,
      instant_booking,
      max_two_in_back,
      price_per_seat,
      total_seats,
      available_seats,
      status,
    ];

    const [result] = await db.query(sql, values);
    return result.insertId;
  }

  static async updateRide(rideId, updateFields) {
    if (!updateFields || Object.keys(updateFields).length === 0) {
      throw new Error("No fields provided for update");
    }
    if (
      updateFields.route_points &&
      typeof updateFields.route_points !== "string"
    ) {
      updateFields.route_points = JSON.stringify(updateFields.route_points);
    }

    const setClauses = [];
    const values = [];

    Object.keys(updateFields).forEach((key) => {
      setClauses.push(`${key} = ?`);
      values.push(updateFields[key]);
    });

    setClauses.push("updated_at = NOW()");

    values.push(rideId);

    const sql = `
      UPDATE rides 
      SET ${setClauses.join(", ")} 
      WHERE id = ?
    `;

    const [result] = await db.query(sql, values);
    return result.affectedRows > 0;
  }

  static async deleteRide(rideId) {
    const sql = `DELETE FROM rides WHERE id = ?`;
    const [result] = await db.query(sql, [rideId]);
    return result.affectedRows > 0;
  }
}

module.exports = RideManagement;
