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

   static async getRideByIdForAdmin (rideId){
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
    if (ride.route_points && typeof ride.route_points === 'string') {
      try {
        ride.route_points = JSON.parse(ride.route_points);
      } catch (err) {
        console.error('Failed to parse route_points JSON:', err);
      }
    }

    return ride;
  }
}

module.exports = RideManagement;
