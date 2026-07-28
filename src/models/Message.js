const db = require("../config/db");

class Message {

    static async getMessages(conversationId) {

        const [rows] = await db.execute(
            `SELECT
                m.*,
                u.id AS sender_id,
                u.name AS sender_name,
                u.profile_image
            FROM messages m
            LEFT JOIN users u
                ON u.id=m.sender_id
            WHERE m.conversation_id=?
            ORDER BY m.id ASC`,
            [conversationId]
        );

        return rows;
    }

    static async create(data) {

        const [result] = await db.execute(
            `INSERT INTO messages
            (
                conversation_id,
                sender_id,
                message
            )
            VALUES
            (
                ?,
                ?,
                ?
            )`,
            [
                data.conversation_id,
                data.sender_id,
                data.message
            ]
        );

        const [rows] = await db.execute(
            `SELECT * FROM messages WHERE id=?`,
            [result.insertId]
        );

        return rows[0];
    }

}

module.exports = Message;