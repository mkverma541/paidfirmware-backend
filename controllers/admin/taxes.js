const { pool } = require("../../config/database");

async function addTax(req, res) {
    try {
        const { title, description, amount, amount_type } = req.body;

        const [result] = await pool.execute(
            `INSERT INTO res_tax_classes (title, description, amount, amount_type) VALUES (?, ?, ?, ?)`,
            [title, description, amount, amount_type]
        );

        return res.status(201).json({ message: "Tax added successfully", taxId: result.insertId });
    } catch (error) {
        console.error("Error adding tax:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

async function getTaxes(req, res) {
    try {
        const [taxes] = await pool.execute(`SELECT * FROM res_tax_classes`);

        return res.status(200).json({ taxes });
    } catch (error) {
        console.error("Error fetching taxes:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


async function updateTax(req, res) {
    try {
        const { id } = req.params; // Assume taxId is passed as a route parameter
        const { title, description, amount, amount_type } = req.body;

        // Update tax entry in the database
        const [result] = await pool.execute(
            `UPDATE res_tax_classes 
            SET title = ?, description = ?, amount = ?, amount_type = ? 
            WHERE class_id = ?`,
            [title, description, amount, amount_type, id]
        );

        // Check if any rows were affected (i.e., if the tax ID exists)
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Tax not found" });
        }

        return res.status(200).json({ message: "Tax updated successfully" });
    } catch (error) {
        console.error("Error updating tax:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


module.exports = { addTax, getTaxes, updateTax };

