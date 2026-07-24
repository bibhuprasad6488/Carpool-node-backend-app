const db = require('../config/db');

class Booking {
    static async getBookingDetails(id) {
        const [bookings] = await db.query("SELECT * FROM ride_bookings WHERE id = ?", [id]);
        return bookings.length ? bookings[0] : null;
    }
}

module.exports = Booking;