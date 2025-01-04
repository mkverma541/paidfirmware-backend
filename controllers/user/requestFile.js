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

module.exports = {
  createRequestFile,
};
