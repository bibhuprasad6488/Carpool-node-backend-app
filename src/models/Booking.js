const db = require("../config/db");

class Booking {
  static async getBookingDetails(id) {
    const [bookings] = await db.query(
      "SELECT * FROM ride_bookings WHERE id = ?",
      [id],
    );
    return bookings.length ? bookings[0] : null;
  }
  static async getAllBookingsForPayment() {
    const [rows] = await db.query(
      `SELECT id, total_price, status, payment_status 
     FROM ride_bookings 
     ORDER BY id DESC`,
    );
    return rows;
  }
  static async getPassengerBookings(passengerId, page = 1, limit = 10) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    // 1. Query to fetch paginated data
    const dataQuery = `
    SELECT 
      -- Booking Details
      b.id AS booking_id,
      b.booking_code,
      b.seats,
      b.price_per_seat,
      b.total_price,
      b.status AS booking_status,
      b.payment_status,
      b.payment_type,
      b.created_at AS booked_at,

      -- Ride Details
      r.id AS ride_id,
      r.source_address AS ride_source,
      r.destination_address AS ride_destination,
      r.source_lat AS ride_source_lat,
      r.source_lng AS ride_source_lng,
      r.destination_lat AS ride_destination_lat,
      r.destination_lng AS ride_destination_lng,
      r.ride_date,
      r.departure_time,
      r.duration_seconds,
      r.estimated_reach_time,
      r.status AS ride_status,

      -- Driver Info
      u.id AS driver_id,
      u.name AS driver_name,
      u.phone AS driver_phone,
      ud.profile_picture AS driver_profile_picture,

      -- Vehicle Info
      v.id AS vehicle_id,
      v.brand AS vehicle_brand,
      v.model AS vehicle_model,
      v.registration_number AS vehicle_registration_number,
      v.color AS vehicle_color,
      v.fuel_type AS vehicle_fuel_type,
      v.vehicle_type

    FROM ride_bookings b
    INNER JOIN rides r ON b.ride_id = r.id
    INNER JOIN users u ON r.driver_id = u.id
    LEFT JOIN user_details ud ON u.id = ud.user_id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    WHERE b.passenger_id = ?
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?;
  `;

    // 2. Query to count total bookings for total pages calculation
    const countQuery = `
    SELECT COUNT(*) AS total 
    FROM ride_bookings 
    WHERE passenger_id = ?;
  `;

    const [rows] = await db.query(dataQuery, [passengerId, limitNum, offset]);
    const [countResult] = await db.query(countQuery, [passengerId]);

    const total = countResult[0]?.total || 0;

    return {
      bookings: rows,
      pagination: {
        totalRecords: total,
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    };
  }
}

module.exports = Booking;
