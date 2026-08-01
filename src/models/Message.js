const db = require("../config/db");

class Message {

    static async getMessages(conversationId) {

        const [rows] = await db.execute(
            `SELECT
                m.*,
                u.id AS sender_id,
                u.role AS sender,
                u.name AS sender_name,
                ud.profile_picture
            FROM messages m
            LEFT JOIN users u
                ON u.id=m.sender_id
            LEFT JOIN user_details ud
                ON ud.user_id=m.sender_id
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
                message,
                created_at,
                updated_at
            )
            VALUES
            (
                ?,
                ?,
                ?,
                NOW(),
                NOW()
            )`,
            [
                data.conversation_id,
                data.sender_id,
                data.message
            ]
        );

        const [rows] = await db.execute(
            `SELECT m.*,
                u.id AS sender_id,
                u.role AS sender,
                u.name AS sender_name,
                ud.profile_picture FROM messages m 
                LEFT JOIN users u
                ON u.id=m.sender_id
                LEFT JOIN user_details ud
                ON ud.user_id=m.sender_id WHERE m.id=?`,
            [result.insertId]
        );

        return rows[0];
    }

}

module.exports = Message;