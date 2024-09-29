const { pool } = require("../../config/database");

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
      ORDER BY date_create DESC
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
};
