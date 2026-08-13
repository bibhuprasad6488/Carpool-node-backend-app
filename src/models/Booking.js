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
}

module.exports = Booking;
