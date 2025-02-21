const { pool } = require("../../../config/database");

async function getTransactions(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination
  const search = req.query.search || ""; // Search filter
  const userId = req.query.userId || null; // Optional user ID filter

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM res_transactions AS t
      INNER JOIN res_users AS u ON t.user_id = u.user_id
      INNER JOIN res_orders AS o ON t.order_id = o.order_id
      WHERE (u.username LIKE ? OR t.gateway_txn_id LIKE ?)
      ${userId ? "AND t.user_id = ?" : ""}
      `,
      userId ? [`%${search}%`, `%${search}%`, userId] : [`%${search}%`, `%${search}%`]
    );

    // Fetch paginated transaction data with joins
    const [transactions] = await pool.execute(
      `
      SELECT 
        t.*,
        u.username, 
        u.first_name,
        u.last_name,
        u.email, 
        o.order_status
      FROM res_transactions AS t
      INNER JOIN res_users AS u ON t.user_id = u.user_id
      INNER JOIN res_orders AS o ON t.order_id = o.order_id
      WHERE (u.username LIKE ? OR t.gateway_txn_id LIKE ?)
      ${userId ? "AND t.user_id = ?" : ""}
      LIMIT ? OFFSET ?
      `,
      userId
        ? [`%${search}%`, `%${search}%`, userId, limit, offset]
        : [`%${search}%`, `%${search}%`, limit, offset]
    );

    // Construct the paginated response
    const result = {
      data: transactions,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    // Return the response
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

module.exports = { getTransactions };
