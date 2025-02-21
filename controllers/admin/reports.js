const { pool } = require("../../config/database");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

async function getTransactions(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination
  const search = req.query.search || ""; // Search filter

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM res_transactions AS t
      INNER JOIN res_users AS u ON t.user_id = u.user_id
      INNER JOIN res_orders AS o ON t.order_id = o.order_id
      WHERE u.username LIKE ? OR t.gateway_txn_id LIKE ?
      `,
      [`%${search}%`, `%${search}%`]
    );

    // Fetch paginated transaction data with joins
    const [transactions] = await pool.execute(
      `
      SELECT 
        t.*, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.email, 
        o.order_status
      FROM res_transactions AS t
      INNER JOIN res_users AS u ON t.user_id = u.user_id
      INNER JOIN res_orders AS o ON t.order_id = o.order_id
      WHERE u.username LIKE ? OR t.gateway_txn_id LIKE ?
      LIMIT ? OFFSET ?
      `,
      [`%${search}%`, `%${search}%`, limit, offset]
    );

    // Construct the paginated response
    const result = {
      data: transactions,
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

async function getDownloadsHistory(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `
            SELECT COUNT(*) AS total
            FROM res_udownloads
            `
    );

    // Join the table with res_files to get the file name and calculate canDownload
    const [rows] = await pool.execute(
      `
            SELECT res_udownloads.*, res_files.title, res_files.size, res_files.folder_id,
            (res_udownloads.expired_at > NOW()) AS canDownload
            FROM res_udownloads
            LEFT JOIN res_files 
            ON res_udownloads.file_id = res_files.file_id
            LIMIT ? OFFSET ?
            `,
      [limit, offset]
    );

    // Ensure canDownload is returned as true/false in JavaScript
    const result = rows.map((row) => ({
      ...row,
      canDownload: !!row.canDownload, // Convert 1/0 to true/false
    }));

    // Construct the paginated response
    const response = {
      data: result,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    res.status(200).json({
      status: "success",
      response: response,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getWalletTransactions(req, res) {
  const { page = 1, limit = 10 } = req.query; // Default page is 1, limit is 10

  // Ensure `page` and `limit` are numbers and greater than 0
  const pageNumber = parseInt(page, 10);
  const pageSize = parseInt(limit, 10);

  if (
    isNaN(pageNumber) ||
    pageNumber <= 0 ||
    isNaN(pageSize) ||
    pageSize <= 0
  ) {
    return res.status(400).json({
      message: "Pagination parameters must be positive numbers.",
      status: "error",
    });
  }

  const offset = (pageNumber - 1) * pageSize; // Calculate the offset

  try {
    // Fetch total transactions count (no user_id condition)
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM res_transfers`
    );

    // Fetch paginated transactions with user details
    const [transactions] = await pool.query(
      `
      SELECT 
        t.*, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.email
      FROM res_transfers AS t
      INNER JOIN res_users AS u ON t.user_id = u.user_id
      ORDER BY t.created_at DESC 
      LIMIT ? OFFSET ?
      `,
      [pageSize, offset]
    );

    const result = {
      data: transactions,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    return res.status(500).json({
      message:
        "An error occurred while fetching transactions. Please try again.",
      status: "error",
    });
  }
}

async function getAllFiles(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM res_files`
    );

    // Fetch paginated files and join with the res_folders table based on folder_id
    const [rows] = await pool.execute(
      `SELECT 
        rf.file_id, 
        rf.folder_id, 
        rf.title, 
        rf.is_active, 
        rf.is_new,
        rf.is_featured,
        rf.description, 
        rf.size, 
        rf.price, 
        rf.is_featured, 
        rf.downloads, 
        rf.visits,
        f.title  AS folder
      FROM res_files rf
      LEFT JOIN res_folders f ON rf.folder_id = f.folder_id
      ORDER BY rf.title ASC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Parse tags field to ensure it's an array
    const filesWithParsedTags = rows.map((file) => {
      return {
        ...file,
        tags: file.tags ? JSON.parse(file.tags) : [], // Ensure tags is an array
      };
    });

    // Construct the paginated response
    const result = {
      data: filesWithParsedTags,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    res.status(200).json({
      status: "success",
      response: result, // Send files with parsed tags and folder information
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

async function getPackages(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM res_upackages`
    );

    // SQL query to select all fields (*) from both res_upackages and res_download_packages with pagination
    const [packages] = await pool.execute(
      `
      SELECT 
        res_upackages.*, 
        res_download_packages.*
      FROM res_upackages
      LEFT JOIN res_download_packages 
      ON res_upackages.package_id = res_download_packages.package_id
      ORDER BY res_upackages.date_create ASC
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );

    // Construct the paginated response
    const result = {
      data: packages,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    // Send the response with the package list
    res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getDownladsVisitors(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM res_download_visitors`
    );

    // Fetch paginated download visitors data and join with res_files to get file details
    const [rows] = await pool.execute(
      `SELECT 
        dv.*, 
        f.title AS file, 
        f.size AS file_size 
      FROM res_download_visitors dv
      LEFT JOIN res_files f ON dv.file_id = f.file_id
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Construct the paginated response
    const result = {
      data: rows,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getStaffActivity(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM res_staff_activity_records`
    );

    // Fetch paginated staff activity records and join with res_staff table
    const [rows] = await pool.execute(
      `SELECT 
        sar.*, 
        s.email, 
        s.first_name, 
        s.last_name 
      FROM res_staff_activity_records sar
      LEFT JOIN res_staff s ON sar.staff_id = s.staff_id
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Construct the paginated response
    const result = {
      data: rows,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getIpBlacklist(req, res) {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 20; // Default items per page
  const offset = (page - 1) * limit; // Calculate offset for pagination

  try {
    // Fetch total count for pagination
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM res_ip_blacklist`
    );

    // Fetch paginated IP blacklist data
    const [rows] = await pool.execute(
      `SELECT * FROM res_ip_blacklist LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Construct the paginated response
    const result = {
      data: rows,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function downloadTransactionsExcel(req, res) {
  const search = req.query.search || "";

  try {
    // Fetch all transaction data with joins
    const [transactions] = await pool.execute(
      `
      SELECT 
        t.*, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.email, 
        o.order_status
      FROM res_transactions AS t
      INNER JOIN res_users AS u ON t.user_id = u.user_id
      INNER JOIN res_orders AS o ON t.order_id = o.order_id
      WHERE u.username LIKE ? OR t.gateway_txn_id LIKE ?
      `,
      [`%${search}%`, `%${search}%`]
    );

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");

    // Define columns
    worksheet.columns = [
      { header: "Username", key: "username", width: 20 },
      { header: "First Name", key: "first_name", width: 15 },
      { header: "Last Name", key: "last_name", width: 15 },
      { header: "Email", key: "email", width: 25 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Gateway Transaction ID", key: "gateway_txn_id", width: 25 },
      { header: "Order Status", key: "order_status", width: 15 },
      { header: "Created At", key: "created_at", width: 20 },
    ];

    // Add data to worksheet
    transactions.forEach((transaction) => {
      worksheet.addRow(transaction);
    });

    // Set the file path
    const filePath = path.join(__dirname, "transactions.xlsx");

    // Write to file
    await workbook.xlsx.writeFile(filePath);

    // Send the file to client
    res.download(filePath, "transactions.xlsx", (err) => {
      if (err) {
        console.error("File download error:", err);
        return res
          .status(500)
          .json({ status: "error", message: "File download failed" });
      }
      // Remove the file after download to clean up
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error("Database or file error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function downloadWalletTransactionsExcel(req, res) {
  const search = req.query.search || "";

  try {
    // Fetch wallet transactions with user details
    const [transactions] = await pool.execute(
      `
      SELECT 
        t.*, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.email
      FROM res_transfers AS t
      INNER JOIN res_users AS u ON t.user_id = u.user_id
      WHERE u.username LIKE ? OR t.transaction_id LIKE ?
      `,
      [`%${search}%`, `%${search}%`]
    );

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Wallet Transactions");

    // Define columns
    worksheet.columns = [
      { header: "Username", key: "username", width: 20 },
      { header: "First Name", key: "first_name", width: 15 },
      { header: "Last Name", key: "last_name", width: 15 },
      { header: "Email", key: "email", width: 25 },
      { header: "Transaction ID", key: "transaction_id", width: 25 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Transaction Type", key: "transaction_type", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Created At", key: "created_at", width: 20 },
    ];

    // Add data to worksheet
    transactions.forEach((transaction) => {
      worksheet.addRow(transaction);
    });

    // Set the file path
    const filePath = path.join(__dirname, "wallet_transactions.xlsx");

    // Write to file
    await workbook.xlsx.writeFile(filePath);

    // Send the file to client
    res.download(filePath, "wallet_transactions.xlsx", (err) => {
      if (err) {
        console.error("File download error:", err);
        return res
          .status(500)
          .json({ status: "error", message: "File download failed" });
      }
      // Remove the file after download to clean up
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error("Database or file error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  getTransactions,
  getDownloadsHistory,
  getWalletTransactions,
  getAllFiles,
  getPackages,
  getDownladsVisitors,
  getStaffActivity,
  getIpBlacklist,
  downloadTransactionsExcel,
  downloadWalletTransactionsExcel,
};
