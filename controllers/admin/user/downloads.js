const { pool } = require("../../../config/database");

async function getDownloadsHistory(req, res) {
  const { userId: id } = req.query;

  try {
    // Join the table with res_files to get the file name and calculate canDownload
    const [rows] = await pool.execute(
      `
      SELECT res_udownloads.*, res_files.title, res_files.size, res_files.folder_id,
      (res_udownloads.expired_at > NOW()) AS canDownload
      FROM res_udownloads
      LEFT JOIN res_files 
      ON res_udownloads.file_id = res_files.file_id
      WHERE res_udownloads.user_id = ?
      `,
      [id]
    );

    // Ensure canDownload is returned as true/false in JavaScript
    const result = rows.map(row => ({
      ...row,
      canDownload: !!row.canDownload, // Convert 1/0 to true/false
    }));

    res.status(200).json({
      data: result,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


module.exports = {
  getDownloadsHistory
 };
