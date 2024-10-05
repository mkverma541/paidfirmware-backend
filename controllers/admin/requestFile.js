const { pool } = require("../../config/database");


// Create a new file request
async function createRequestFile(req, res) {
    try {
        const { name, email, phone, subject, message, user_id = null } = req.body;

        const query = `
            INSERT INTO res_file_requests (name, email, phone, subject, message, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await pool.query(query, [name, email, phone, subject, message, user_id]);

        res.status(201).json({
            message: "File request created successfully",
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

// Get a list of file requests
async function getRequestFiles(req, res) {
    try {
        const query = `
            SELECT rfr.id, rfr.name, rfr.email, rfr.phone, rfr.subject, rfr.message, rfr.created_at,
                   u.username AS user_name, u.email AS user_email, u.phone AS user_phone
            FROM res_file_requests rfr
            LEFT JOIN res_users u ON rfr.user_id = u.user_id
        `;

        const [rows] = await pool.query(query);

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

module.exports = {
    createRequestFile,
    getRequestFiles,
};