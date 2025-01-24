const { pool } = require("../../../config/database");

async function getProfile(req, res) {
  const { userId: id } = req.query;

  try {
    const [[user]] = await pool.execute(
      `SELECT * FROM res_users WHERE user_id = ?`,
      [id]
    );

    res.status(200).json({
      user,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  getProfile,
};
