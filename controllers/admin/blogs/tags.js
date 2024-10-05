const { pool } = require("../../../config/database");

// Create a new tag
async function createTag(req, res) {
    try {
        const { name } = req.body;

        const query = `INSERT INTO res_blogs_tags (name) VALUES (?)`;
        await pool.query(query, [name]);

        res.status(201).json({ message: "Tag created successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

// Get all tags
async function getTags(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM res_blogs_tags");

        res.status(200).json({ data: rows, status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

// Delete a tag
async function deleteTag(req, res) {
    try {
        const { id } = req.params;

        const query = `DELETE FROM res_blogs_tags WHERE tag_id = ?`;
        await pool.query(query, [id]);

        res.status(200).json({ message: "Tag deleted successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

module.exports = { createTag, getTags, deleteTag };
