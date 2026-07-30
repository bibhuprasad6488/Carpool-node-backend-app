const db = require("../../config/db");

const PaymentModel = {
  async findAll({ page = 1, limit = 10, status, gateway, search }) {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClauses = [];

    if (status) {
      whereClauses.push("payment_status = ?");
      params.push(status);
    }

    if (gateway) {
      whereClauses.push("payment_gateway = ?");
      params.push(gateway);
    }

    if (search) {
      whereClauses.push(
        "(booking_code LIKE ? OR booking_id LIKE ? OR order_id LIKE ? OR payment_id LIKE ?)",
      );
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const dataQuery = `
      SELECT 
        id, booking_code, booking_id, order_id, payment_id, 
        refund_id, refunded_at, payment_status, payment_gateway, 
        created_at, updated_at
      FROM payments
      ${whereSQL}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM payments ${whereSQL}`;

    const [rows] = await db.query(dataQuery, [
      ...params,
      Number(limit),
      Number(offset),
    ]);
    const [[{ total }]] = await db.query(countQuery, params);

    return {
      payments: rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id) {
    const query = `
      SELECT 
        id, booking_code, booking_id, order_id, payment_id, 
        refund_id, refunded_at, payment_status, payment_gateway, 
        created_at, updated_at
      FROM payments 
      WHERE id = ? 
      LIMIT 1
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0] || null;
  },

  async updateStatus(id, { payment_status, refund_id, refunded_at }) {
    const fields = [];
    const params = [];

    if (payment_status) {
      fields.push("payment_status = ?");
      params.push(payment_status);
    }

    if (refund_id !== undefined) {
      fields.push("refund_id = ?");
      params.push(refund_id);
    }

    if (refunded_at !== undefined) {
      fields.push("refunded_at = ?");
      params.push(refunded_at);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = NOW()");
    params.push(id);

    const query = `UPDATE payments SET ${fields.join(", ")} WHERE id = ?`;
    const [result] = await db.query(query, params);
    return result.affectedRows > 0;
  },

  async findByPassengerId(passengerId, { page = 1, limit = 10, status }) {
    const offset = (page - 1) * limit;
    const params = [passengerId];
    let whereClauses = ["rb.passenger_id = ?"];

    if (status) {
      whereClauses.push("p.payment_status = ?");
      params.push(status);
    }

    const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

    const dataQuery = `
      SELECT 
        p.id AS payment_table_id,
        p.booking_code,
        p.booking_id,
        p.order_id,
        p.payment_id,
        p.refund_id,
        p.refunded_at,
        p.payment_status,
        p.payment_gateway,
        p.created_at AS payment_created_at,
        rb.passenger_id,
        rb.ride_source,
        rb.ride_destination,
        rb.total_price,
        rb.seats
      FROM payments p
      INNER JOIN ride_bookings rb 
        ON p.booking_id = rb.id OR p.booking_code = rb.booking_code
      ${whereSQL}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM payments p
      INNER JOIN ride_bookings rb 
        ON p.booking_id = rb.id OR p.booking_code = rb.booking_code
      ${whereSQL}
    `;

    const [rows] = await db.query(dataQuery, [
      ...params,
      Number(limit),
      Number(offset),
    ]);
    const [[{ total }]] = await db.query(countQuery, params);

    return {
      transactions: rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};

module.exports = PaymentModel;
