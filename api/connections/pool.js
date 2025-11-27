const mysql2 = require('mysql2');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const caCertPath = path.join(__dirname, '../../ca.pem');

const pool = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 5, 
    queueLimit: 0,

    ssl: {
        ca: fs.readFileSync(caCertPath),
        rejectUnauthorized: true
    }
}).promise();

module.exports = pool;