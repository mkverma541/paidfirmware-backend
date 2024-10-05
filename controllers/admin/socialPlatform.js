const { pool } = require("../../config/database");

// Create a new social platform
async function createSocialPlatform(req, res) {
    try {
        const { name, url, icon } = req.body;

        const query = `
            INSERT INTO res_social_platforms (name, url, icon)
            VALUES (?, ?, ?)
        `;
        await pool.query(query, [name, url, icon]);

        res.status(201).json({
            message: "Social platform created successfully",
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

// Get all social platforms

async function getSocialPlatforms(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM res_social_platforms");

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

// Delete a social platform

async function deleteSocialPlatform(req, res) {
    try {
        const { id } = req.params;

        const query = `
            DELETE FROM res_social_platforms
            WHERE id = ?
        `;
        await pool.query(query, [id]);

        res.status(200).json({
            message: "Social platform deleted successfully",
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
    createSocialPlatform,
    getSocialPlatforms,
    deleteSocialPlatform,
};
