const { pool } = require("../../../config/database");

async function getDownloadsHistory(req, res) {
  const { id } = req.user;
  const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10

  const offset = (page - 1) * limit;

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
      LIMIT ? OFFSET ?
      `,
      [id, parseInt(limit), parseInt(offset)]
    );

    // Ensure canDownload is returned as true/false in JavaScript
    const result = rows.map(row => ({
      ...row,
      canDownload: !!row.canDownload, // Convert 1/0 to true/false
    }));

    // Get the total count of downloads for pagination
    const [countResult] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM res_udownloads
      WHERE user_id = ?
      `,
      [id]
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      data: result,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
      },
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function downloadFile(req, res) {
  const { fileId } = req.params;
  const { id } = req.user;

  try {
    // Check if the user has a valid package
    const [userPackage] = await pool.execute(
      `SELECT * FROM res_upackages WHERE user_id = ?`,
      [id]
    );

    if (!userPackage.length) {
      return res.status(400).json({ error: "No valid package found" });
    }

    // Check if the user has an active package
    const [validPackage] = await pool.execute(
      "SELECT * FROM res_upackages WHERE user_id = ? AND date_expire > NOW() LIMIT 1",
      [id]
    );

    if (!validPackage.length) {
      return res.status(400).json({ error: "No active package found" });
    }

    // Check the current package
    const [currentPackage] = await pool.execute(
      `SELECT * FROM res_upackages WHERE user_id = ? AND is_current = 1 AND date_expire > NOW() LIMIT 1`,
      [id]
    );

    if (!currentPackage.length) {
      return res.status(400).json({ error: "No current package found" });
    }

    // Get package details based on current package id (including daily fair usage)
    const [packageDetails] = await pool.execute(
      `SELECT * FROM res_download_packages WHERE package_id = ?`,
      [currentPackage[0].package_id]
    );

    const dailyDownloadLimit = packageDetails[0].fair_files || 0; // Add fair usage limit from package

    // Count total bandwidth used by the user for the current package
    const [totalBandwidth] = await pool.execute(
      `SELECT SUM(res_files.size) as total_bandwidth 
       FROM res_udownloads 
       LEFT JOIN res_files ON res_udownloads.file_id = res_files.file_id 
       WHERE res_udownloads.user_id = ? AND res_udownloads.upackage_id = ?`,
      [id, currentPackage[0].package_id]
    );

    // Check the file size of the requested file
    const [file] = await pool.execute(
      `SELECT * FROM res_files WHERE file_id = ?`,
      [fileId]
    );

    if (!file.length) {
      return res.status(404).json({ error: "File not found" });
    }

    // Get the size of the file the user is trying to download
    const fileSize = file[0].size;

    // Check the total bandwidth used and compare it with the package's limit
    const remainingBandwidth =
      packageDetails[0].bandwidth - (totalBandwidth[0].total_bandwidth || 0);

    if (remainingBandwidth < fileSize) {
      return res.status(400).json({
        error: "Bandwidth limit exceeded. Unable to download the file.",
      });
    }

    // Fair usage limit: check how many files the user has downloaded in the last 24 hours
    const [dailyDownloads] = await pool.execute(
      `SELECT COUNT(*) AS daily_download_count 
       FROM res_udownloads 
       WHERE user_id = ? 
       AND upackage_id = ? 
       AND created_at > NOW() - INTERVAL 1 DAY`,
      [id, currentPackage[0].package_id]
    );

    // Check if the user has exceeded their daily download limit
    if (dailyDownloads[0].daily_download_count >= dailyDownloadLimit) {
      return res.status(400).json({
        error: `Download limit reached. You can only download ${dailyDownloadLimit} files per day.`,
      });
    }

    // Generate the download link with token
    const fileLink = await generateDownloadLink(
      fileId,
      id,
      currentPackage[0].package_id
    );

    // Return the download link
    res.status(200).json({
      link: fileLink,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function generateDownloadLink(req, res) {
  const { id } = req.user;
  const userId = id;

  const { file_id, order_id = null, package_id = null } = req.body;

  try {
    // Check if the file exists
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [file_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    // Check if already added to the user downloads matching order_id, user_id, and file_id
    const [isAlreadyDownloaded] = await pool.execute(
      `SELECT * FROM res_udownloads WHERE user_id = ? AND file_id = ? AND order_id = ?`,
      [userId, file_id, order_id]
    );

    // If a record exists, return the old token
    if (isAlreadyDownloaded.length > 0) {
      return res.status(200).json({
        status: "success",
        link: `${process.env.APP_BASE_URL}/download?token=${isAlreadyDownloaded[0].hash_token}`,
        isDownloaded: true,
      });
    }

    // Generate a new token and expiration time
    const token = crypto.randomBytes(32).toString("hex");
    const expirationTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours
    const expirationDate = new Date(expirationTime * 1000); // Convert to Date object

    // Insert a new entry for the user download
    await pool.execute(
      `INSERT INTO res_udownloads (user_id, file_id, upackage_id, order_id, hash_token, expired_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, file_id, package_id, order_id, token, expirationDate]
    );

    // Return the newly generated download link
    return res.status(200).json({
      status: "success",
      link: `${process.env.APP_BASE_URL}/download?token=${token}`,
      isDownloaded: false,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

module.exports = {
  getDownloadsHistory,
  downloadFile,
 };
