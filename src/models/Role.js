const db = require('../config/db');

class Role {
    static async getAll() {
        const [roles] = await db.query(
            'SELECT * FROM roles WHERE id !=?', [1]
        );

        return roles;
    }
}