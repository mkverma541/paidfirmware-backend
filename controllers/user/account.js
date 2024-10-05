const { pool } = require("../../config/database");
const { generateDownloadLink } = require("./digitalFiles");

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
      ORDER BY res_upackages.date_create ASC
      `,
      [id]
    );

    // Log packages for debugging
    console.log("Packages fetched:", packages);

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

async function getPackagesDetails(req, res) {
  const { id } = req.user;

  try {
    // SQL query to get data from both res_upackages and res_download_packages
    const [packages] = await pool.execute(
      `
      SELECT res_upackages.*, res_download_packages.*
      FROM res_upackages
      LEFT JOIN res_download_packages 
      ON res_upackages.package_id = res_download_packages.package_id
      WHERE res_upackages.user_id = ?
      ORDER BY res_upackages.date_create DESC
      `,
      [id]
    );

    // Log packages for debugging
    console.log("Packages fetched:", packages);

    // Iterate over each package to compute additional values
    const packageData = await Promise.all(
      packages.map(async (pkg) => {
        const upackageId = pkg.upackage_id; // Use the unique 'upackage_id'

        // Log for debugging
        console.log(`Processing upackage_id: ${upackageId}`);

        // Calculate total bandwidth usage for each unique package instance
        const [totalBandwidth] = await pool.execute(
          `
          SELECT SUM(res_files.size) AS total_bandwidth_usage
          FROM res_udownloads
          LEFT JOIN res_files ON res_udownloads.file_id = res_files.file_id
          WHERE res_udownloads.user_id = ? AND res_udownloads.upackage_id = ?
          `,
          [id, upackageId] // Use 'upackage_id'
        );

        // Log bandwidth usage for debugging
        console.log(
          `Total bandwidth for upackage_id ${upackageId}:`,
          totalBandwidth
        );

        // Calculate total downloads in the last 24 hours (for fair usage)
        const [dailyDownloads] = await pool.execute(
          `
          SELECT COUNT(*) AS daily_usage
          FROM res_udownloads
          WHERE user_id = ? AND upackage_id = ? AND date_create >= NOW() - INTERVAL 24 HOUR
          `,
          [id, upackageId] // Use 'upackage_id'
        );

        // Log daily downloads for debugging
        console.log(
          `Daily downloads for upackage_id ${upackageId}:`,
          dailyDownloads
        );

        // Attach the calculated values to each package
        return {
          ...pkg,
          total_bandwidth_used: totalBandwidth[0].total_bandwidth_usage || 0, // Total bandwidth usage in bytes
          daily_downloads: dailyDownloads[0].daily_usage || 0, // Daily usage in terms of number of files downloaded in the last 24 hours
        };
      })
    );

    // Send the response with the additional data
    res.status(200).json({
      data: packageData,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getOrders(req, res) {
  const { id } = req.user;

  try {
    const [rows] = await pool.execute(
      `
      SELECT * FROM res_orders
      WHERE user_id = ?
      ORDER BY date_create DESC
      `,
      [id]
    );

    res.status(200).json({
      data: rows,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getDownloadsHistory(req, res) {
  const { id } = req.user;

  try {
    // join the table with res_files to get the file name

    const [rows] = await pool.execute(
      `
      SELECT res_udownloads.*, res_files.title, res_files.size, res_files.folder_id
      FROM res_udownloads
      LEFT JOIN res_files 
      ON res_udownloads.file_id = res_files.file_id
      WHERE user_id = ?
      `,
      [id]
    );

    res.status(200).json({
      data: rows,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getBalanceTransferHistory(req, res) {
  const { id } = req.user;

  try {
    const [rows] = await pool.execute(
      ` 
      SELECT * FROM res_transfers
      WHERE user_id = ?
      `,
      [id]
    );

    res.status(200).json({
      data: rows,
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
       AND date_create > NOW() - INTERVAL 1 DAY`,
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

async function getOrderDetails(req, res) {
  const { id } = req.user; // User ID from the authenticated user
  const { orderId } = req.params; // Order ID from the request parameters

  try {
    // Fetch the order details
    const [order] = await pool.execute(
      `SELECT * FROM res_orders WHERE user_id = ? AND order_id = ?`,
      [id, orderId]
    );

    if (!order.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Fetch package details if the user has purchased any packages
    const [packageBuy] = await pool.execute(
      `
      SELECT up.*, dp.title, dp.description 
      FROM res_upackages up
      JOIN res_download_packages dp ON up.package_id = dp.package_id
      WHERE up.user_id = ? AND up.order_id = ?
      `,
      [id, orderId]
    );

    // Fetch file details if the user has purchased any files
    const [filesBuy] = await pool.execute(
      `
      SELECT uf.*, f.title, f.description, f.size, f.folder_id 
      FROM res_ufiles uf
      JOIN res_files f ON uf.file_id = f.file_id
      WHERE uf.user_id = ? AND uf.order_id = ?
      `,
      [id, orderId]
    );

    // Construct response object with populated data
    let response = {
      order: order[0],
      packages: packageBuy.length ? packageBuy : null, // Populate packages if available
      files: filesBuy.length ? filesBuy : null, // Populate files if available
    };

    res.status(200).json({
      data: response,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getOrderDetailsByPaymentId(req, res) {
  const { id } = req.user; // User ID from the authenticated user
  const { paymentId } = req.params; // Order ID from the request parameters

  console.log("Payment ID:", paymentId);
  try {
    // Fetch the order details
    const [order] = await pool.execute(
      `SELECT * FROM res_orders WHERE user_id = ? AND payment_id = ?`,
      [id, paymentId]
    );

    const orderId = order[0].order_id;
    console.log("Order ID:", orderId);

    if (!order.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Fetch package details if the user has purchased any packages
    const [packageBuy] = await pool.execute(
      `
      SELECT up.*, dp.title, dp.description 
      FROM res_upackages up
      JOIN res_download_packages dp ON up.package_id = dp.package_id
      WHERE up.user_id = ? AND up.order_id = ?
      `,
      [id, orderId]
    );

    // Fetch file details if the user has purchased any files
    const [filesBuy] = await pool.execute(
      `
      SELECT uf.*, f.title, f.description, f.size, f.folder_id 
      FROM res_ufiles uf
      JOIN res_files f ON uf.file_id = f.file_id
      WHERE uf.user_id = ? AND uf.order_id = ?
      `,
      [id, orderId]
    );

    // Construct response object with populated data
    let response = {
      order: order[0],
      packages: packageBuy.length ? packageBuy : null, // Populate packages if available
      files: filesBuy.length ? filesBuy : null, // Populate files if available
    };

    res.status(200).json({
      data: response,
      status: "success",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  getPackages,
  getOrders,
  getDownloadsHistory,
  getBalanceTransferHistory,
  downloadFile,
  updateCurrentPackage,
  getOrderDetails,
  getOrderDetailsByPaymentId,
};
