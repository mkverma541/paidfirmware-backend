const { pool, secretKey } = require("../config/database");

async function getUserProfile(req, res) {
  const { id } = req.user;

  const connection = await pool.getConnection(); // Get DB connection

  try {
    const [user] = await connection.execute(
      "SELECT * FROM users WHERE user_id = ?",
      [id]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release(); // Release connection
  }
}


module.exports = {
  getUserProfile,
};
