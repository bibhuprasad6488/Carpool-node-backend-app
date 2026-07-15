const mysql = require('mysql2/promise');

if (process.env.NODE_ENV == 'local') {
    var pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'carpool_nest',
        waitForConnections: true,
        connectionLimit: 10
    });
} else {
    var pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10
    });
}


module.exports = pool;