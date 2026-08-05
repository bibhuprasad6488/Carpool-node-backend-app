// src/models/Conversation.js
const db = require("../../config/db");

class Conversation {
  // static async getAll() {
  //   const query = `
  //     SELECT 
  //       c.id,
  //       c.booking_id,
  //       c.ride_id,
  //       c.driver_id,
  //       d.name AS driver_name,
  //       d.email AS driver_email,
  //       c.passenger_id,
  //       p.name AS passenger_name,
  //       p.email AS passenger_email,
  //       r.source_address,
  //       r.destination_address,
  //       c.created_at,
  //       c.updated_at
  //     FROM conversations c
  //     LEFT JOIN users d ON c.driver_id = d.id
  //     LEFT JOIN users p ON c.passenger_id = p.id
  //     LEFT JOIN rides r ON c.ride_id = r.id
  //     ORDER BY c.updated_at DESC
  //   `;
  //   const [conversations] = await db.execute(query);
  //   return conversations;
  // }

  // static async findById(id) {
  //   const query = `
  //     SELECT 
  //       c.*,
  //       d.name AS driver_name,
  //       p.name AS passenger_name
  //     FROM conversations c
  //     LEFT JOIN users d ON c.driver_id = d.id
  //     LEFT JOIN users p ON c.passenger_id = p.id
  //     WHERE c.id = ? 
  //     LIMIT 1
  //   `;
  //   const [rows] = await db.execute(query, [id]);
  //   return rows[0] || null;
  // }

  // static async findByBookingId(bookingId) {
  //   const query = `
  //     SELECT * FROM conversations WHERE booking_id = ? LIMIT 1
  //   `;
  //   const [rows] = await db.execute(query, [bookingId]);
  //   return rows[0] || null;
  // }

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

  static async getAllConversations({ page = 1, limit = 10, search }) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        c.*,
        d.name AS driver_name,
        d.email AS driver_email,
        d.phone AS driver_phone,
        p.name AS passenger_name,
        p.email AS passenger_email,
        p.phone AS passenger_phone,
        r.source_address,
        r.destination_address,
        (SELECT m.message FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
      FROM conversations c
      LEFT JOIN users d ON c.driver_id = d.id
      LEFT JOIN users p ON c.passenger_id = p.id
      LEFT JOIN rides r ON c.ride_id = r.id
    `;

    const queryParams = [];

    if (search) {
      query += ` WHERE c.ride_id LIKE ? OR d.name LIKE ? OR p.name LIKE ? OR d.phone LIKE ? OR p.phone LIKE ? OR r.source_address LIKE ? OR r.destination_address LIKE ?`;
      const searchTerm = `%${search}%`;
      queryParams.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    query += ` ORDER BY last_message_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(Number(limit), Number(offset));

    const [rows] = await db.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM conversations c
      LEFT JOIN users d ON c.driver_id = d.id
      LEFT JOIN users p ON c.passenger_id = p.id
      LEFT JOIN rides r ON c.ride_id = r.id
    `;
    const countParams = [];
    if (search) {
      countQuery += ` WHERE c.ride_id LIKE ? OR d.name LIKE ? OR p.name LIKE ? OR d.phone LIKE ? OR p.phone LIKE ? OR r.source_address LIKE ? OR r.destination_address LIKE ?`;
      const searchTerm = `%${search}%`;
      countParams.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    const [countResult] = await db.query(countQuery, countParams);
    const totalRecords = countResult[0].total;

    return {
      conversations: rows,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: Number(page),
    };
  }

  static async findById(id) {
    const [rows] = await db.query(
      `
      SELECT 
        c.*,
        d.name AS driver_name,
        d.phone AS driver_phone,
        p.name AS passenger_name,
        p.phone AS passenger_phone
      FROM conversations c
      LEFT JOIN users d ON c.driver_id = d.id
      LEFT JOIN users p ON c.passenger_id = p.id
      WHERE c.id = ?
    `,
      [id],
    );
    return rows[0];
  }

  static async getMessagesByConversationId(conversationId) {
    const [rows] = await db.query(
      `
      SELECT 
        m.*,
        u.name AS sender_name,
        u.role AS sender_role
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `,
      [conversationId],
    );
    return rows;
  }
}

module.exports = Conversation;
