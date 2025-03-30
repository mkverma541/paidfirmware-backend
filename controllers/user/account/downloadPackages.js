const { pool } = require("../../../config/database");

async function getPackages(req, res) {
  const { id } = req.user;

  try {
    // SQL query to select the necessary fields from both res_upackages and res_download_packages
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
