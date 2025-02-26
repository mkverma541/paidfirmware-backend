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
    const [users] = await connection.execute(
      "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );

    const [[{ total }]] = await connection.execute(
      "SELECT COUNT(*) AS total FROM users"
    );

    const result = {
      users,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release(); // Release connection
  }
}

async function getUserById(req, res) {
  const connection = await pool.getConnection(); // Get DB connection

  const { id } = req.params;

  try {
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE user_id = ? LIMIT 1",
      [id] 
    );


    if (!users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      status: "success",
      response: users[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release(); // Release connection
  }
}

async function updateUser(req, res) {
  const connection = await pool.getConnection(); // Get DB connection

  const {
    user_id,
    username,
    password,
    email,
    first_name = null,
    last_name = null,
    phone = null,
    role = "manager",
    status
  } = req.body;

  
  try {
    const [result] = await connection.execute(
      "UPDATE users SET username = ?, password = ?, email = ?, first_name = ?, last_name = ?, phone = ?, status = ?, role = ? WHERE user_id = ?",
      [username, password, email, first_name, last_name, phone, status, role, user_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      status: "success",
      response: "User updated successfully",
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
  getUserById,
  updateUser,
};
