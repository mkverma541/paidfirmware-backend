const { pool } = require("../../config/database");

// Create a new file request
async function createRequestFile(req, res) {
  try {
    const {
      fullName,
      email,
      fileType,
      priority,
      purpose,
      additionalInfo = null,
      user_id = null, // Optional, if user is logged in
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !fileType || !priority || !purpose) {
      return res.status(400).json({
        message: "Missing required fields.",
        status: "error",
      });
    }

    const query = `
      INSERT INTO res_file_requests 
        (name, email, file_type, priority, purpose, additional_info, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(query, [
      fullName.trim(),
      email,
      fileType,
      priority,
      purpose,
      additionalInfo,
      user_id,
    ]);

    return res.status(201).json({
      message: "File request submitted successfully.",
      status: "success",
    });
  } catch (err) {
    console.error("Error while creating file request:", err);
    return res.status(500).json({
      message: "Internal server error.",
      status: "error",
    });
  }
}

module.exports = {
  createRequestFile,
};
