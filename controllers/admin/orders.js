const { pool } = require("../../config/database");

async function getAllOrderList(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Current page, default to 1
  const limit = parseInt(req.query.limit, 10) || 20; // Items per page, default to 20
  const offset = (page - 1) * limit; // Calculate offset for pagination
  const search = req.query.search || ""; // Search term, default to empty string

  try {
    // Base query for total count of orders
    let totalQuery = `
      SELECT COUNT(*) as total 
      FROM res_orders AS o 
      WHERE o.order_id LIKE ?
    `;
    let totalParams = [`%${search}%`];

    // Fetch total count of orders for pagination
    const [[{ total }]] = await pool.execute(totalQuery, totalParams);

    // Base query for fetching orders and user details
    let ordersQuery = `
      SELECT 
        o.*, 
        u.user_id, 
        u.username, 
        u.email, 
        u.phone, 
        u.first_name,
        u.last_name
      FROM res_orders AS o
      LEFT JOIN res_users AS u ON o.user_id = u.user_id
      WHERE o.order_id LIKE ?
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    let ordersParams = [`%${search}%`, limit, offset];

    // Fetch paginated orders
    const [orders] = await pool.execute(ordersQuery, ordersParams);

    // Map and initialize grouped orders with user details
    const groupedOrders = orders.map((order) => ({
      order_id: order.order_id,
      created_at: order.created_at,
      amount_due: order.amount_due,
      amount_paid: order.amount_paid,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
      currency: order.currency,
      item_types: JSON.parse(order.item_types || "[]"), // Parse item_type JSON
      user_id: order.user_id,
      username: order.username,
      email: order.email,
      first_name: order.first_name,
      last_name: order.last_name,
      phone: order.phone,
      products: [],
      files: [],
      topups: [],
    }));

    // Process each order based on `item_types`
    await Promise.all(
      groupedOrders.map(async (order) => {
        const { order_id, item_types } = order;

        // Fetch topups if applicable
        if (item_types.includes(5)) {
          const [topups] = await pool.execute(
            `
              SELECT amount, created_at 
              FROM res_uwallet_recharge 
              WHERE order_id = ?
            `,
            [order_id]
          );

          if (topups.length) {
            order.topups.push(...topups);
          }
        }

        // Fetch digital products if applicable
        if (item_types.includes(3)) {
          const [products] = await pool.execute(
            `
              SELECT 
                up.product_id, 
                up.quantity,
                rp.product_name, 
                rp.sale_price, 
                rp.slug,
                m.file_name AS image
              FROM res_uproducts AS up
              INNER JOIN res_products AS rp ON up.product_id = rp.product_id
              LEFT JOIN res_product_media AS m ON rp.product_id = m.product_id AND m.is_cover = 1
              WHERE up.order_id = ?
            `,
            [order_id]
          );

          if (products.length) {
            order.products.push(...products);
          }
        }
      })
    );

    // Construct the paginated response
    const result = {
      data: groupedOrders,
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

async function getOrderDetails(req, res) {
  const { order_id } = req.params; // Order ID from the request parameters

  try {
    // Fetch order details with user details
    const [[order]] = await pool.execute(
      `
        SELECT 
          o.order_id,
          o.created_at,
          o.amount_due,
          o.amount_paid,
          o.payment_method,
          o.payment_status,
          o.order_status,
          o.currency,
          o.notes,
          o.item_types,
          u.user_id,
          u.username,
          u.email,
          u.phone,
          u.first_name,
          u.last_name
        FROM res_orders AS o
        LEFT JOIN res_users AS u ON o.user_id = u.user_id
        WHERE o.order_id = ?
      `,
      [order_id]
    );

    // Check if order exists
    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    // Parse `item_types`
    order.item_types = JSON.parse(order.item_types || "[]");

    // Initialize response structure
    const orderDetails = {
      order_id: order.order_id,
      created_at: order.created_at,
      amount_due: order.amount_due,
      amount_paid: order.amount_paid,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
      currency: order.currency,
      notes: order.notes,
      user_id: order.user_id,
      username: order.username,
      email: order.email,
      phone: order.phone,
      first_name: order.first_name,
      last_name: order.last_name,
      products: [],
      topups: [],
    };

    // Fetch topups if applicable
    if (order.item_types.includes(5)) {
      const [topups] = await pool.execute(
        `
          SELECT amount, created_at 
          FROM res_uwallet_recharge 
          WHERE order_id = ?
        `,
        [order_id]
      );

      if (topups.length) {
        orderDetails.topups.push(...topups);
      }
    }

    // Fetch products if applicable
    if (order.item_types.includes(3)) {
      const [products] = await pool.execute(
        `
          SELECT 
            up.product_id,
            up.quantity,
            up.meta,
            rp.product_name,
            rp.sale_price,
            rp.slug,
            m.file_name AS image
          FROM res_uproducts AS up
          INNER JOIN res_products AS rp ON up.product_id = rp.product_id
          LEFT JOIN res_product_media AS m ON rp.product_id = m.product_id AND m.is_cover = 1
          WHERE up.order_id = ?
        `,
        [order_id]
      );

      if (products.length) {
        orderDetails.products.push(...products);
      }
    }

    // Return the response
    return res.status(200).json({
      status: "success",
      response: orderDetails,
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
  getOrderDetails,
};
