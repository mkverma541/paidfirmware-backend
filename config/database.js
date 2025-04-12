const fs = require("fs");
const mysql = require("mysql2/promise");

// Create a MariaDB connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 20, // Use connection pooling
  queueLimit: 0,
});

// Test connection once at startup
pool.getConnection()
  .then((connection) => {
    console.log("✅ MariaDB Connected");
    connection.release(); // Release back to pool
  })
  .catch((err) => {
    console.error("❌ MariaDB Connection Error:", err);
    process.exit(1); // Exit the app
  });

const secretKey = process.env.JWT_SECRET; 

module.exports = { pool, secretKey };
