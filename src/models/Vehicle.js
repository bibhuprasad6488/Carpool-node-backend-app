const db = require("../config/db");

class Vehicle {

    static async getByUserId(userId) {

        const sql = `
            SELECT *
            FROM vehicles
            WHERE user_id = ?
            ORDER BY id DESC
        `;

        const [rows] = await db.execute(sql, [userId]);

        return rows;
    }

    static async allVehicleLists() {

        const sql = `
            SELECT *
            FROM vehicles ORDER BY id DESC
        `;

        const [rows] = await db.execute(sql);

        return rows;
    }

}

module.exports = Vehicle;