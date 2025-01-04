const { pool } = require("../../config/database");

async function getUserRegistrationChart(req, res) {
    const { startDate, endDate } = req.query;
  
    // Set default to today's date if no dates are provided
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
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
      const monthDiff = (endDateObj.getFullYear() - startDateObj.getFullYear()) * 12 + (endDateObj.getMonth() - startDateObj.getMonth());
  
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
      const chartData = userRegistrations.map(entry => {
        const periodString = entry.period instanceof Date ? 
          entry.period.toISOString().split('T')[0] : 
          entry.period.toString(); // Convert to string
  
        const dateParts = periodString.split('-'); // Split by '-' for date or month
        const formattedPeriod = monthDiff === 0 
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
  

  
module.exports = {
  getUserRegistrationChart,
};
