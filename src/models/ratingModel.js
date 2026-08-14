// models/ratingModel.js
const db = require("../config/db");

class RatingModel {
  static async getBookingForRating(connection, bookingId, passengerId) {
    const query = `
      SELECT b.id, b.ride_id, b.status, r.driver_id 
      FROM ride_bookings b
      JOIN rides r ON b.ride_id = r.id
      WHERE b.id = ? AND b.passenger_id = ?
    `;
    const [rows] = await connection.query(query, [bookingId, passengerId]);
    return rows[0];
  }

  // Check if a rating already exists for this booking
  static async findByBookingId(connection, bookingId) {
    const query = `SELECT id FROM ratings WHERE booking_id = ? LIMIT 1`;
    const [rows] = await connection.query(query, [bookingId]);
    return rows[0];
  }

  // Insert a new rating
  static async create(
    connection,
    { rideId, bookingId, passengerId, rating, review },
  ) {
    await connection.query("SET time_zone = '+05:30'");

    const query = `
      INSERT INTO ratings (ride_id, booking_id, passenger_id, rating, review, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const [result] = await connection.query(query, [
      rideId,
      bookingId,
      passengerId,
      rating,
      review || null,
    ]);
    return result.insertId;
  }

  static async getAllForAdmin({ page = 1, limit = 10, ratingFilter }) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT rt.*, 
             p.name as passenger_name, p.phone as passenger_phone,
             r.ride_date, r.source_address, r.destination_address,
             d.name as driver_name
      FROM ratings rt
      JOIN users p ON rt.passenger_id = p.id
      JOIN rides r ON rt.ride_id = r.id
      JOIN users d ON r.driver_id = d.id
    `;
    const queryParams = [];

    if (ratingFilter) {
      query += ` WHERE rt.rating = ?`;
      queryParams.push(ratingFilter);
    }

    query += ` ORDER BY rt.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(Number(limit), Number(offset));

    const [rows] = await db.query(query, queryParams);

    // Get total record count for pagination metadata
    let countQuery = `SELECT COUNT(*) as total FROM ratings rt`;
    const countParams = [];
    if (ratingFilter) {
      countQuery += ` WHERE rt.rating = ?`;
      countParams.push(ratingFilter);
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

  // Admin: Delete a rating (if flagged or abusive)
  static async deleteById(ratingId) {
    const query = `DELETE FROM ratings WHERE id = ?`;
    const [result] = await db.query(query, [ratingId]);
    return result;
  }
}

module.exports = RatingModel;
