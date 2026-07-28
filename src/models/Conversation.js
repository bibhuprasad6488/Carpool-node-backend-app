const db = require("../config/db");

class Conversation {

    static async findByBookingId(bookingId) {

        const [rows] = await db.execute(
            `SELECT * FROM conversations WHERE booking_id=? LIMIT 1`,
            [bookingId]
        );

        return rows[0] || null;
    }

    static async findById(id) {

        const [rows] = await db.execute(
            `SELECT * FROM conversations WHERE id=? LIMIT 1`,
            [id]
        );

        return rows[0] || null;
    }

}

module.exports = Conversation;