const { pool } = require("../../config/database");
const bcrypt = require("bcrypt");

async function checkUsername(req, res) {
  const {username} = req.params;

  try {
    // Check if username already exists
    const [existingUser] = await pool.execute(
      "SELECT * FROM res_users WHERE username = ?",
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "Username already exists, please try another username",
      });
    }

    return res.status(200).json({
      message: "Username is available",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function addNewUser(req, res) {
  const {
    password,
    email,
    role_id = null,
    first_name = null,
    last_name = null,
    user_type = 1,
  } = req.body;

  // Check for missing required fields

  if (!password || !email) {
    return res.status(400).json({ error: "Please fill all required fields." });
  }

  try {
    // Check if username already exists

    const [existingUser] = await pool.execute(
      "SELECT * FROM res_users WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "Email already exists, please try another email",
      });
    }

    let username = email.split("@")[0];

    // Check if email already exists
    const [existingUsername] = await pool.execute(
      "SELECT * FROM res_users WHERE username = ?",
      [username]
    );

    if (existingUsername.length > 0) {
      // generate username random
      username = username + Math.floor(1000 + Math.random() * 9000);
    }

    // Hash password asynchronously
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into the database
    const [data] = await pool.execute(
      "INSERT INTO res_users (username, password, email, first_name, last_name, role_id, user_type ) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        username,
        hashedPassword,
        email,
        first_name,
        last_name,
        role_id,
        user_type,
      ]
    );

    // Fetch the newly created user
    const [user] = await pool.execute(
      "SELECT * FROM res_users WHERE user_id = ?",
      [data.insertId]
    );
    // Send back user details
    return res
      .status(201)
      .json({ message: "User registered successfully", user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getAllUserList(req, res) {
  const page = parseInt(req.query.page) || 1; // Get page from query, default to 1
  const limit = parseInt(req.query.limit) || 20; // Limit per page
  const offset = (page - 1) * limit; // Calculate offset based on page
  const search = req.query.search ? `%${req.query.search}%` : "%"; // Use wildcard for empty search

  try {
    // Fetch the filtered users with pagination and sorting by date_create
    const [users] = await pool.execute(
      `
      SELECT * 
      FROM res_users
      WHERE username LIKE ? OR email LIKE ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [search, search, limit, offset]
    );

    // Fetch total count of matching users for pagination
    const [[{ total }]] = await pool.execute(
      `
      SELECT COUNT(*) as total
      FROM res_users
      WHERE username LIKE ? OR email LIKE ?
      `,
      [search, search]
    );

    const result = {
      data: users,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page, // Pass the correct current page
    };

    // Send response with users and pagination info
    return res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  getAllUserList,
  addNewUser,
  checkUsername,
};
