const { faker } = require('@faker-js/faker');
const { pool } = require("./config/database");

// Function to generate fake IP blacklist records
const generateIpBlacklistRecords = (count = 5000) => {
    return Array.from({ length: count }, () => {
        return [
            faker.internet.ip(), // Random IP address
            faker.lorem.sentence(), // Random reason for blacklist
            faker.date.between({ from: '2023-01-01', to: '2024-12-31' }) // created_at
                .toISOString()
                .slice(0, 19)
                .replace('T', ' '), // MySQL DATETIME format
            faker.date.recent({ days: 30 }) // updated_at
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ') // MySQL DATETIME format
        ];
    });
};

// Function to insert fake IP blacklist records into the database
const insertIpBlacklistRecords = () => {
    const sql = `
        INSERT INTO res_ip_blacklist (ip_address, reason, created_at, updated_at) 
        VALUES ?
    `;
    const values = generateIpBlacklistRecords();

    pool.query(sql, [values], (err, result) => {
        if (err) {
            console.error("IP Blacklist Insert Error:", err);
            return;
        }
        console.log(`Inserted ${result.affectedRows} fake IP blacklist records`);
    });
};

// Run the function
insertIpBlacklistRecords();
