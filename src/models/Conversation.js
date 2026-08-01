const db = require("../config/db");

class Conversation {
    static async findByBookingId(bookingId) {
        const [rows] = await db.execute(
            `SELECT * FROM conversations WHERE booking_id=? LIMIT 1`,
            [bookingId],
        );
        return rows[0] || null;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT * FROM conversations WHERE id=? LIMIT 1`,
            [id],
        );
        return rows[0] || null;
    }

    static async create({
        booking_id,
        ride_id,
        driver_id,
        passenger_id }) {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                `INSERT INTO conversations
                (
                    booking_id, ride_id, driver_id, passenger_id, created_at, updated_at
                )
                VALUES
                (
                    ?, ?, ?, ?, NOW(), NOW()
                )`,
                [
                    booking_id,
                    ride_id,
                    driver_id,
                    passenger_id
                ],
            );

            await connection.commit();
            return result.insertId;

        } catch (err) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = Conversation;
