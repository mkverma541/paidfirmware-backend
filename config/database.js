const fs = require("fs");
const mysql = require("mysql2/promise");

// Load config.json
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Set environment variables
Object.keys(config).forEach((key) => {
  process.env[key] = config[key];
});

// Create a MariaDB connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10, // Use connection pooling
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
  });

module.exports = { pool };
