const { pool } = require("../../../config/database");

async function getPackages(req, res) {
  const { userId: id } = req.query;

  try {
    // SQL query to select all fields (*) from both res_upackages and res_download_packages
    const [packages] = await pool.execute(
      `
      SELECT 
        res_upackages.*, 
        res_download_packages.*
      FROM res_upackages
      LEFT JOIN res_download_packages 
      ON res_upackages.package_id = res_download_packages.package_id
      WHERE res_upackages.user_id = ?
      ORDER BY res_upackages.date_create ASC
      `,
      [id]
    );


    // Send the response with the package list
    res.status(200).json({
      data: packages,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


async function updateCurrentPackage(req, res) {
  const { packageId, userId: id } = req.query;

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
