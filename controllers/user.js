/**
 * Retrieves all users from the database.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves to sending a JSON response with the users data or an error message.
 */
const { pool } = require("../config/database");

async function getUsers(req, res) {
  const connection = await pool.getConnection(); // Get DB connection

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const [users] = await connection.execute("SELECT * FROM users LIMIT ? OFFSET ?", [limit, offset]);
    const [[{ total }]] = await connection.execute("SELECT COUNT(*) AS total FROM users");

    return res.status(200).json({
      users,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release(); // Release connection
  }
}

async function insertTestUser(req, res) {
  const connection = await pool.getConnection(); // Get DB connection

  const username = req.query.username;  
  const amount = req.query.amount;
  
  try {

    const [users] = await connection.execute("INSERT INTO test (username, amount) VALUES (?, ?)", [username, amount]);
   
    return res.status(200).json({
      users
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release(); // Release connection
  }
}

module.exports = {
  getUsers,
  insertTestUser
};
