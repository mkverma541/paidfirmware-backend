const { pool } = require("../../config/database");

// Create a new contact query
async function createContactQuery(req, res) {
    try {
        const { name, email, phone, subject, message } = req.body;

        const query = `
            INSERT INTO res_contact_queries (name, email, phone, subject, message)
            VALUES (?, ?, ?, ?, ?)
        `;

        await pool.query(query, [name, email, phone, subject, message]);

        res.status(201).json({
            message: "Contact query created successfully",
            status: "success",
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal server error",
            status: "error",
        });
    }
}

// Get all contact queries
async function getContactQueries(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM res_contact_queries");

        res.status(200).json({
            data: rows,
            status: "success",
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal server error",
            status: "error",
        });
    }
}

// Export the functions
module.exports = {
    createContactQuery,
    getContactQueries
};
