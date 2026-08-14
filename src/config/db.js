const mysql = require('mysql2/promise');

const dbConfig = {
    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+05:30',
    dateStrings: true
};

if (process.env.NODE_ENV === 'local') {
    var pool = mysql.createPool({
        ...dbConfig,
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'carpool_nest'
    });
} else {
    pool = mysql.createPool({
        ...dbConfig,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectTimeout: 10000,
        ssl: {
            rejectUnauthorized: false
        }
    });
}

module.exports = pool;