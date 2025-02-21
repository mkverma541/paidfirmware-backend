const { pool } = require("../../config/database");

async function getUserRegistrationChart(req, res) {
  const { startDate, endDate } = req.query;

  // Set default to today's date if no dates are provided
  const today = new Date();
  const formattedToday = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
  const start = startDate || formattedToday;
  const end = endDate || formattedToday;

  // Validate the date inputs
  if (!start || !end) {
    return res.status(400).json({
      status: "error",
      message: "Please provide both startDate and endDate.",
    });
  }

  try {
    // Convert dates to Date objects for comparison
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    // Calculate the difference in months
    const monthDiff =
      (endDateObj.getFullYear() - startDateObj.getFullYear()) * 12 +
      (endDateObj.getMonth() - startDateObj.getMonth());

    // Determine the aggregation based on the range
    let aggregation, groupBy;
    if (monthDiff === 0) {
      // If the date range is within the same month, group by day
      aggregation = `DATE(created_at) AS period`;
      groupBy = `GROUP BY period ORDER BY period ASC`;
    } else {
      // If the date range is more than one month, group by month
      aggregation = `DATE_FORMAT(created_at, '%Y-%m') AS period`; // Format: YYYY-MM
      groupBy = `GROUP BY period ORDER BY period ASC`;
    }

    // Query to fetch user registration counts grouped by date or month
    const [userRegistrations] = await pool.execute(
      `
        SELECT ${aggregation}, COUNT(*) AS count
        FROM res_users
        WHERE created_at BETWEEN ? AND ?
        ${groupBy}
        `,
      [start, end]
    );

    // Format the result for the line chart
    const chartData = userRegistrations.map((entry) => {
      const periodString =
        entry.period instanceof Date
          ? entry.period.toISOString().split("T")[0]
          : entry.period.toString(); // Convert to string

      const dateParts = periodString.split("-"); // Split by '-' for date or month
      const formattedPeriod =
        monthDiff === 0
          ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` // Format as dd/mm/yyyy
          : `${dateParts[1]}/${dateParts[0]}`; // Format as mm/yyyy for months

      return {
        date_create: formattedPeriod.trim(),
        count: entry.count,
      };
    });

    return res.status(200).json({
      status: "success",
      data: chartData,
    });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getRecentUsers(req, res) {
  try {
    // Query to fetch the most recent 10 user registrations
    const [recentUsers] = await pool.execute(
      `
        SELECT user_id, first_name, last_name, email, phone, created_at
        FROM res_users
        ORDER BY created_at DESC
        LIMIT 10
        `
    );

    return res.status(200).json({
      status: "success",
      data: recentUsers,
    });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getRecentOrders(req, res) {
  try {
    const [recentOrders] = await pool.execute(
      `
      SELECT o.order_id, o.user_id, o.total_amount, o.currency,  o.created_at, u.first_name, u.last_name, u.email
      FROM res_orders o
      JOIN res_users u ON o.user_id = u.user_id
      ORDER BY o.created_at DESC
      LIMIT 10
      `
    );

    return res.status(200).json({
      status: "success",
      data: recentOrders,
    });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getStats(req, res) {
  try {
    // Query to fetch the total users

    const [totalUsers] = await pool.execute(
      `
        SELECT COUNT(*) AS total_users
        FROM res_users
        `
    );

    // Query to fetch the total orders

    const [totalOrders] = await pool.execute(
      `
        SELECT COUNT(*) AS total_orders
        FROM res_orders
        `
    );

    // Query to fetch the total products

    const [totalProducts] = await pool.execute(
      `
        SELECT COUNT(*) AS total_products
        FROM res_products
        `
    );

    // Query to fetch the total files

    const [totalFiles] = await pool.execute(
      `
        SELECT COUNT(*) AS total_files
        FROM res_files
        `
    );

    // Query to fetch the total coureses

    const [totalCourses] = await pool.execute(
      `
        SELECT COUNT(*) AS total_courses
        FROM res_courses
        `
    );

    res.status(200).json({
      status: "success",
      data: {
        totalUsers: totalUsers[0].total_users,
        totalOrders: totalOrders[0].total_orders,
        totalProducts: totalProducts[0].total_products,
        totalFiles: totalFiles[0].total_files,
        totalCourses: totalCourses[0].total_courses,
      },
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
  getUserRegistrationChart,
  getRecentUsers,
  getRecentOrders,
  getStats,
};
