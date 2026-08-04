// src/models/Conversation.js
const db = require("../../config/db");

class Conversation {
  static async getAll() {
    const query = `
      SELECT 
        c.id,
        c.booking_id,
        c.ride_id,
        c.driver_id,
        d.name AS driver_name,
        d.email AS driver_email,
        c.passenger_id,
        p.name AS passenger_name,
        p.email AS passenger_email,
        r.source_address,
        r.destination_address,
        c.created_at,
        c.updated_at
      FROM conversations c
      LEFT JOIN users d ON c.driver_id = d.id
      LEFT JOIN users p ON c.passenger_id = p.id
      LEFT JOIN rides r ON c.ride_id = r.id
      ORDER BY c.updated_at DESC
    `;
    const [conversations] = await db.execute(query);
    return conversations;
  }

  static async findById(id) {
    const query = `
      SELECT 
        c.*,
        d.name AS driver_name,
        p.name AS passenger_name
      FROM conversations c
      LEFT JOIN users d ON c.driver_id = d.id
      LEFT JOIN users p ON c.passenger_id = p.id
      WHERE c.id = ? 
      LIMIT 1
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
  }

  static async findByBookingId(bookingId) {
    const query = `
      SELECT * FROM conversations WHERE booking_id = ? LIMIT 1
    `;
    const [rows] = await db.execute(query, [bookingId]);
    return rows[0] || null;
  }

  // static async getBookingDetails(bookingId) {
  //   const query = `
  //     SELECT 
  //       b.id AS booking_id,
  //       b.ride_id,
  //       b.passenger_id,
  //       r.driver_id
  //     FROM bookings b
  //     JOIN rides r ON r.id = b.ride_id
  //     WHERE b.id = ?
  //     LIMIT 1
  //   `;
  //   const [rows] = await db.execute(query, [bookingId]);
  //   return rows[0] || null;
  // }

  static async create({ booking_id, ride_id, driver_id, passenger_id }) {
    const query = `
    INSERT INTO conversations (booking_id, ride_id, driver_id, passenger_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, NOW(), NOW())
  `;
    const [result] = await db.execute(query, [
      booking_id,
      ride_id,
      driver_id,
      passenger_id,
    ]);
    return this.findById(result.insertId);
  }
  
  static async findOrCreate({ booking_id, ride_id, driver_id, passenger_id }) {
    const existing = await this.findByBookingId(booking_id);
    if (existing) return existing;

    const query = `
      INSERT INTO conversations (booking_id, ride_id, driver_id, passenger_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `;
    const [result] = await db.execute(query, [
      booking_id,
      ride_id,
      driver_id,
      passenger_id,
    ]);
    return this.findById(result.insertId);
  }

  static async getByUserId(userId) {
    const query = `
      SELECT 
        c.*,
        IF(c.driver_id = ?, p.name, d.name) AS other_party_name,
        IF(c.driver_id = ?, p.id, d.id) AS other_party_id
      FROM conversations c
      LEFT JOIN users d ON c.driver_id = d.id
      LEFT JOIN users p ON c.passenger_id = p.id
      WHERE c.driver_id = ? OR c.passenger_id = ?
      ORDER BY c.updated_at DESC
    `;
    const [rows] = await db.execute(query, [userId, userId, userId, userId]);
    return rows;
  }
}

module.exports = Conversation;
