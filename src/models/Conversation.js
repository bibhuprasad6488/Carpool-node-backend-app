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
            await connection.query("SET time_zone = '+05:30'");

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
            throw err;
        } finally {
            connection.release();
        }
    }

    static async findByDriverId(driverId) {
        const [rows] = await db.execute(
            `
        SELECT
            c.id,
            c.booking_id,
            c.ride_id,
            c.driver_id,
            c.passenger_id,
            c.created_at,

            r.status AS ride_status,

            u.id AS user_id,
            u.name AS user_name,
            u.role,
            ud.profile_picture,

            m.id AS message_id,
            m.message AS last_message,
            m.sender_id,
            m.created_at AS last_message_at

        FROM conversations c

        INNER JOIN rides r
            ON r.id = c.ride_id
            AND r.status IN ('scheduled','ongoing')
            
        INNER JOIN users u
            ON u.id = c.passenger_id

        LEFT JOIN user_details ud
            ON ud.user_id = u.id

        INNER JOIN messages m
            ON m.id = (
                SELECT id
                FROM messages
                WHERE conversation_id = c.id
                ORDER BY created_at DESC
                LIMIT 1
            )

        WHERE c.driver_id = ?

        ORDER BY m.created_at DESC
        `,
            [driverId]
        );

        return rows;
    }
}

module.exports = Conversation;
