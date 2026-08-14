const mysql = require('mysql2/promise');

if (process.env.NODE_ENV == 'local') {
    var pool = mysql.createPool({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'carpooling',
        waitForConnections: true,
        connectionLimit: 10
    });
} else {
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 10000,
        ssl: {
            rejectUnauthorized: false
        }
    });
}


module.exports = pool;