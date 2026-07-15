// src/models/User.js

const db = require('../config/db');
const APP_URL = process.env.APP_URL;
const uploadPathUrl = `${APP_URL}/uploads/user/`;

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

        if (rows.length) {
            rows[0].profile_picture = rows[0].profile_picture
                ? `${APP_URL}/uploads/user/${rows[0].profile_picture}`
                : "";
            rows[0].driver_license = rows[0].driver_license
                ? `${APP_URL}/uploads/user/${rows[0].driver_license}`
                : "";
            rows[0].adhhar_card = rows[0].adhhar_card
                ? `${APP_URL}/uploads/user/${rows[0].adhhar_card}`
                : "";
            rows[0].pan_card = rows[0].pan_card
                ? `${APP_URL}/uploads/user/${rows[0].pan_card}`
                : "";
            rows[0].bank_account = rows[0].bank_account
                ? `${APP_URL}/uploads/user/${rows[0].bank_account}`
                : "";
        }

        return rows.length ? rows[0] : null;
    }


}

module.exports = User;