const { pool } = require("../../config/database");

async function addTax(req, res) {
    try {
        const { name, rate, description } = req.body;

        const [result] = await pool.execute(
            `INSERT INTO res_taxes (name, rate, description) VALUES (?, ?, ?)`,
            [name, rate, description]
        );

        return res.status(201).json({ message: "Tax added successfully", taxId: result.insertId });
    } catch (error) {
        console.error("Error adding tax:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


async function getTaxes(req, res) {
    try {
        const [taxes] = await pool.execute(`SELECT * FROM res_taxes`);

        return res.status(200).json({ taxes });
    } catch (error) {
        console.error("Error fetching taxes:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

module.exports = { addTax, getTaxes };

