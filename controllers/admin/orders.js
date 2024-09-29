const { pool } = require("../../config/database");

async function getAllOrderList(req, res) {
    const page = parseInt(req.query.page) || 1; // Get page from query, default to 1
    const limit = parseInt(req.query.limit) || 20; // Limit per page
    const offset = (page - 1) * limit; // Calculate offset based on page
    const search = req.query.search || "";
  
    try {
      // Fetch the filtered orders with pagination and populate user information
      const [orders] = await pool.execute(
        `
        SELECT o.*, u.username, u.fullname
        FROM res_orders o
        LEFT JOIN res_users u ON o.user_id = u.user_id
        WHERE o.order_id LIKE ? OR o.payment_id LIKE ?
        LIMIT ? OFFSET ?
        `,
        [`%${search}%`, `%${search}%`, limit, offset]
      );
  
      // Fetch total count of matching orders for pagination
      const [[{ total }]] = await pool.execute(
        `
        SELECT COUNT(*) as total
        FROM res_orders o
        LEFT JOIN res_users u ON o.user_id = u.user_id
        WHERE o.order_id LIKE ? OR o.payment_id LIKE ?
        `,
        [`%${search}%`, `%${search}%`]
      );
  
      const result = {
        data: orders,
        perPage: limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page, // Pass the correct current page
      };
  
      // Send response with orders and pagination info
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
  getAllOrderList,
};
