const db = require('../config/db');

class Role {
    static async getAllRoles(name = null) {
        // return name;
        let sql = `
            SELECT *
            FROM roles
            WHERE id != ?
        `;

        const params = [1];

        if (name) {
            sql += ` AND name LIKE ?`;
            params.push(`%${name}%`);
        }

        const [rows] = await db.execute(sql, params);
        const roles = rows.map((role) => ({
            id: role.id,
            name: role.name
        }));

        return roles;
    }
}

module.exports = Role;