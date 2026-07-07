// src/models/User.js

const db = require('../config/db');

class User {

    static async getAll() {
        const [users] = await db.query(
            'SELECT * FROM users'
        );

        return users;
    }

    static async findById(id) {
        const [users] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );

        return users[0];
    }

    static async create(data) {
        const { name, email } = data;

        const [result] = await db.query(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            [name, email]
        );

        return result.insertId;
    }

    static async findByEmail(email) {

        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        return rows[0];
    }

    static async getUserDetailsById(id) {

        const sql = `
        SELECT *
        FROM user_details
        WHERE user_id = ?
        LIMIT 1
    `;

        const [rows] = await db.execute(sql, [id]);

        return rows.length ? rows[0] : null;
    }


}

module.exports = User;