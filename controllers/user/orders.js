const { pool } = require("../../config/database");

async function getAllOrderList(req, res) {
  const { id } = req.user; // User ID from the request
  const page = parseInt(req.query.page, 10) || 1; // Current page, default to 1
  const limit = parseInt(req.query.limit, 10) || 20; // Items per page, default to 20
  const offset = (page - 1) * limit; // Calculate offset for pagination
  const search = req.query.search || ""; // Search term, default to empty string

  try {
    // Fetch total count of orders for pagination
    const [[{ total }]] = await pool.execute(
      `
        SELECT COUNT(*) as total
        FROM res_orders AS o
        WHERE o.user_id = ? AND (o.order_id LIKE ?)
      `,
      [id, `%${search}%`]
    );

    // Fetch paginated orders
    const [orders] = await pool.execute(
      `
        SELECT *
        FROM res_orders AS o
        WHERE o.user_id = ? AND (o.order_id LIKE ?)
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [id, `%${search}%`, limit, offset]
    );


    // Map and initialize grouped orders
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
      products: [],
      files: [],
      topups: [],
      packages: [],
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
              WHERE order_id = ? AND user_id = ?
            `,
            [order_id, id]
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
              WHERE up.order_id = ? AND up.user_id = ?
            `,
            [order_id, id]
          );

          if (products.length) {
            order.products.push(...products);
          }
        }

        // Fetch files if applicable
        if (item_types.includes(1)) {
          const [files] = await pool.execute(
            `
              SELECT 
                rf.file_id,
                rf.folder_id,
                rf.title,
                rf.thumbnail,
                rf.size,
                rf.price,
                rf.slug,
                uf.ufile_id,
                uf.user_id,
                uf.order_id,
                uf.date_create AS ufile_date_create
              FROM res_files rf
              JOIN res_ufiles uf ON rf.file_id = uf.file_id
              WHERE uf.order_id = ? AND uf.user_id = ?
            `,
            [order_id, id]
          );

          if (files.length) {
            order.files.push(...files);
          }
        }

        // fetch download package

        if (item_types.includes(2)) {
          const [packages] = await pool.execute(
            `
              SELECT 
    up.package_id, 
    rp.title, 
    rp.sale_price
FROM res_upackages AS up
INNER JOIN res_download_packages AS rp ON up.package_id = rp.package_id
WHERE up.order_id = ? AND up.user_id = ?

            `,
            [order_id, id]
          );

          console.log("Packages:", packages);

          if (packages.length) {
            order.packages.push(...packages);
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
  const { id } = req.user; // User ID from the request
  const { order_id } = req.params; // Order ID from the request parameters

  try {
    // Fetch order details
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
          o.item_types
        FROM res_orders AS o
        WHERE o.user_id = ? AND o.order_id = ?
      `,
      [id, order_id]
    );

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    // Parse item_types
    order.item_types = JSON.parse(order.item_types || "[]");

    // Initialize details
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
      products: [],
      topups: [],
      files: [],
    };

    // Fetch topups if applicable
    if (order.item_types.includes(5)) {
      const [topups] = await pool.execute(
        `
          SELECT amount, created_at 
          FROM res_uwallet_recharge 
          WHERE order_id = ? AND user_id = ?
        `,
        [order_id, id]
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
          WHERE up.order_id = ? AND up.user_id = ?
        `,
        [order_id, id]
      );

      if (products.length) {
        orderDetails.products.push(...products);
      }
    }

    // Fetch files if applicable
    if (order.item_types.includes(1)) {
      const [files] = await pool.execute(
        `
          SELECT 
            rf.file_id,
            rf.folder_id,
            rf.title,
            rf.thumbnail,
            rf.size,
            rf.price,
            rf.slug,
            uf.ufile_id,
            uf.user_id,
            uf.order_id,
            uf.date_create AS ufile_date_create
          FROM res_files rf
          JOIN res_ufiles uf ON rf.file_id = uf.file_id
          WHERE uf.order_id = ? AND uf.user_id = ?
        `,
        [order_id, id]
      );

      if (files.length) {
        orderDetails.files.push(...files);
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
