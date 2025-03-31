const { pool } = require("../../../config/database");

async function getPackages(req, res) {
  const { id } = req.user;
  const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10

  const offset = (page - 1) * limit;

  try {
    // SQL query to select the necessary fields from both res_upackages and res_download_packages with pagination
    const [packages] = await pool.execute(
      `
      SELECT 
        res_upackages.is_active,
        res_upackages.date_create,
        res_upackages.date_expire,
        res_upackages.is_current,
        res_download_packages.title
      FROM res_upackages
      LEFT JOIN res_download_packages 
      ON res_upackages.package_id = res_download_packages.package_id
      WHERE res_upackages.user_id = ?
      ORDER BY res_upackages.date_create DESC
      LIMIT ? OFFSET ?
      `,
      [id, parseInt(limit), parseInt(offset)]
    );

    // Get the total count of packages for the user
    const [[{ total }]] = await pool.execute(
      `
      SELECT COUNT(*) as total
      FROM res_upackages
      WHERE user_id = ?
      `,
      [id]
    );

    // Send the response with the package list and pagination info
    res.status(200).json({
      data: packages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function updateCurrentPackage(req, res) {
  const { packageId } = req.params;
  const { id } = req.user;

  try {
    // Set all packages for the user to is_current = 0
    await pool.execute(
      `UPDATE res_upackages SET is_current = 0 WHERE user_id = ?`,
      [id]
    );

    // Set the selected package to is_current = 1
    await pool.execute(
      `UPDATE res_upackages SET is_current = 1 WHERE user_id = ? AND upackage_id = ?`,
      [id, packageId]
    );

    res.status(200).json({
      status: "success",
      message: `Package ${packageId} is now set as the current package.`,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  getPackages,
  updateCurrentPackage,
};
