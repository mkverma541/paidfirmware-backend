const { pool } = require("../../config/database");

async function contactUsEnquiry(req, res) {
    try {
        const { name, email, phone, subject, message, user_id = null } = req.body;

        // table res_contact_enquiries
        const query = `
            INSERT INTO res_contact_enquiries (name, email, phone, subject, message, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        await pool.query(query, [name, email, phone, subject, message, user_id]);

        res.status(201).json({
            message: "Your message has been submitted successfully and we will get back to you shortly",
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
    contactUsEnquiry,
};