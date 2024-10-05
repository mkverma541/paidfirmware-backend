const { pool } = require("../../../config/database");

// Create a new category
async function createCategory(req, res) {
    try {
        const { name, parent_id = null } = req.body;

        const query = `INSERT INTO res_blogs_categories (name, parent_id) VALUES (?, ?)`;
        await pool.query(query, [name, parent_id]);

        res.status(201).json({ message: "Category created successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

// Get all categories
async function getCategories(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT category_id, name, parent_id 
            FROM res_blogs_categories
        `);

        res.status(200).json({ data: rows, status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

// Delete a category
async function deleteCategory(req, res) {
    try {
        const { id } = req.params;

        const query = `DELETE FROM res_blogs_categories WHERE category_id = ?`;
        await pool.query(query, [id]);

        res.status(200).json({ message: "Category deleted successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

module.exports = { createCategory, getCategories, deleteCategory };
