const fs = require('fs');

const mysql = require('mysql2/promise');

// Determine the current environment
const environment = process.env.NODE_ENV || 'development';

// Set the configuration file based on the environment
let configFileName;

switch (environment) {
  case 'production':
    configFileName = 'config-prod.json';
    break;
  case 'development':
    configFileName = 'config-dev.json';
    break;
  case 'local':
  default:
    configFileName = 'config.json'; // Default to local config
    break;
}

// Load the appropriate config file
//const config = JSON.parse(fs.readFileSync(configFileName, 'utf8'));
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));


// Set environment variables
process.env.DB_HOST = config.DB_HOST;
process.env.DB_USER = config.DB_USER;
process.env.DB_PASSWORD = config.DB_PASSWORD;
process.env.DB_DATABASE = config.DB_DATABASE;
process.env.SECRET_KEY = config.SECRET_KEY;
process.env.RAZORPAY_KEY_ID = config.RAZORPAY_KEY_ID;
process.env.RAZORPAY_KEY_SECRET = config.RAZORPAY_KEY_SECRET;
process.env.STRIPE_SECRET_KEY = config
process.env.BINANCE_API_KEY = config.BINANCE_API_KEY;
process.env.BINANCE_API_SECRET = config.BINANCE_API_SECRET;


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const secretKey = process.env.SECRET_KEY;

module.exports = { pool, secretKey };

