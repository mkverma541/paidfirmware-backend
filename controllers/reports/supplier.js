const { pool } = require("../../config/database");
const ExcelJS = require("exceljs");
const moment = require("moment");

const { LINK_STATUS_KEY } = require("../utils/constants");

// Supplier-related methods
const searchSuppliers = async (req, res) => {
  const { query } = req.query;

  try {
    const [data] = await pool.query(
      `SELECT supplier_id, supplier_code, supplier_name
       FROM suppliers
       WHERE supplier_name LIKE ? OR supplier_code LIKE ?
       ORDER BY supplier_code DESC`,
      [`%${query}%`, `%${query}%`]
    );

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error searching suppliers:", error);
    return res.status(500).json({
      success: false,
      message: "Error searching suppliers",
    });
  }
};

const getSupplierProjects = async (req, res) => {
  const { supplier_id } = req.query;

  try {
    // First get all projects for the supplier
    const [projects] = await pool.query(
      `SELECT 
        p.project_id, 
        p.project_code, 
        p.project_name, 
        c.name as country_name
       FROM projects p
       INNER JOIN countries c ON p.country_code = c.code
       WHERE p.supplier_id = ?
       ORDER BY p.project_name ASC`,
      [supplier_id]
    );

    if (projects.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const projectIds = projects.map((p) => p.project_id);

    // Get total respondents and test link counts
    const [baseCounts] = await pool.query(
      `SELECT 
        project_id,
        COUNT(*) as total_respondents,
        SUM(test_link = 1) as test_link_count
       FROM project_report
       WHERE project_id IN (?)
       GROUP BY project_id`,
      [projectIds]
    );

    // Get status counts
    const [statusCounts] = await pool.query(
      `SELECT 
        project_id,
        status,
        COUNT(*) as count
       FROM project_report
       WHERE project_id IN (?)
       GROUP BY project_id, status`,
      [projectIds]
    );

    // Create lookup maps
    const baseCountsMap = new Map();
    baseCounts.forEach((row) => {
      baseCountsMap.set(row.project_id, {
        total_respondents: row.total_respondents,
        test_link_count: row.test_link_count,
      });
    });

    const statusCountsMap = new Map();
    statusCounts.forEach((row) => {
      if (!statusCountsMap.has(row.project_id)) {
        statusCountsMap.set(row.project_id, {});
      }
      statusCountsMap.get(row.project_id)[row.status] = row.count;
    });

    // Merge the data
    const result = projects.map((project) => {
      const base = baseCountsMap.get(project.project_id) || {
        total_respondents: 0,
        test_link_count: 0,
      };

      const statuses = statusCountsMap.get(project.project_id) || {};

      // Initialize all status counts
      const allStatusCounts = {};
      Object.keys(LINK_STATUS_KEY).forEach((status) => {
        allStatusCounts[`${status}_count`] = statuses[status] || 0;
      });
      allStatusCounts.unknown_status_count = statuses[null] || 0;

      return {
        ...project,
        total_respondents: base.total_respondents,
        test_link_count: base.test_link_count,
        ...allStatusCounts,
      };
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching supplier projects:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching supplier projects",
      error: error.message,
    });
  }
};

const downloadSupplierReportExcel = async (req, res) => {
  const { supplier_id, start_date, end_date } = req.query;

  try {
    // Validate date parameters
    if (start_date && !moment(start_date, "YYYY-MM-DD", true).isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date format. Use YYYY-MM-DD",
      });
    }

    if (end_date && !moment(end_date, "YYYY-MM-DD", true).isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid end date format. Use YYYY-MM-DD",
      });
    }

    const [supplierData] = await pool.query(
      `SELECT supplier_code, supplier_name
       FROM suppliers
       WHERE supplier_id = ?`,
      [supplier_id]
    );

    const supplier = supplierData[0];

    // Base query with optional date filtering
    let query = `
      SELECT 
        p.project_id, 
        p.project_code, 
        p.project_name, 
        c.name AS country_name,
        p.created_at
      FROM projects p
      INNER JOIN countries c ON p.country_code = c.code
      WHERE p.supplier_id = ?
    `;

    const queryParams = [supplier_id];

    if (start_date && end_date) {
      query += ` AND p.created_at BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    } else if (start_date) {
      query += ` AND p.created_at >= ?`;
      queryParams.push(start_date);
    } else if (end_date) {
      query += ` AND p.created_at <= ?`;
      queryParams.push(end_date);
    }

    query += ` ORDER BY p.project_name ASC`;

    // Fetch projects
    const [projects] = await pool.query(query, queryParams);

    if (projects.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const projectIds = projects.map((p) => p.project_id);

    // Fetch base counts
    const [baseCounts] = await pool.query(
      `SELECT 
        project_id,
        COUNT(*) AS total_respondents,
        SUM(test_link = 1) AS test_link_count
       FROM project_report
       WHERE project_id IN (?)
       GROUP BY project_id`,
      [projectIds]
    );

    // Fetch status counts
    const [statusCounts] = await pool.query(
      `SELECT 
        project_id,
        status,
        COUNT(*) AS count
       FROM project_report
       WHERE project_id IN (?)
       GROUP BY project_id, status`,
      [projectIds]
    );

    // Create lookup maps
    const baseCountsMap = new Map();
    baseCounts.forEach((row) => {
      baseCountsMap.set(row.project_id, {
        total_respondents: row.total_respondents,
        test_link_count: row.test_link_count,
      });
    });

    const statusCountsMap = new Map();
    statusCounts.forEach((row) => {
      if (!statusCountsMap.has(row.project_id)) {
        statusCountsMap.set(row.project_id, {});
      }
      statusCountsMap.get(row.project_id)[row.status] = row.count;
    });

    // Merge the data
    const result = projects.map((project) => {
      const base = baseCountsMap.get(project.project_id) || {
        total_respondents: 0,
        test_link_count: 0,
      };

      const statuses = statusCountsMap.get(project.project_id) || {};

      const allStatusCounts = {};
      Object.keys(LINK_STATUS_KEY).forEach((status) => {
        allStatusCounts[`${status}_count`] = statuses[status] || 0;
      });

      allStatusCounts.unknown_status_count = statuses[null] || 0;

      return {
        ...project,
        total_respondents: base.total_respondents,
        test_link_count: base.test_link_count,
        ...allStatusCounts,
      };
    });

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Supplier Projects");

    // File name with date range
    const dateRange =
      start_date && end_date
        ? `${start_date}_to_${end_date}`
        : start_date
        ? `from_${start_date}`
        : end_date
        ? `to_${end_date}`
        : moment().format("YYYY-MM-DD");

    const fileName = `Supplier_Projects_${dateRange}.xlsx`;

    // Add Project Summary Header
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = `Project Summary Report - Supplier`;
    worksheet.getCell("A1").font = { bold: true, size: 18 };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF" },
    };
    worksheet.getRow(1).height = 30;

    // Supplier Details Header
    worksheet.mergeCells("A2:H2");
    worksheet.getCell(
      "A2"
    ).value = `Supplier Name: ${supplier.supplier_name} (Supplier Code: ${supplier.supplier_code})`;
    worksheet.getCell("A2").font = { bold: true, size: 14 };
    worksheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(2).height = 25;

    // Date Range Header
    const dateRangeText =
      start_date && end_date
        ? `From Date: ${moment(start_date).format(
            "DD-MMM-YYYY"
          )} To Date: ${moment(end_date).format("DD-MMM-YYYY")}`
        : "Full Data Range";

    worksheet.mergeCells("A3:H3");
    worksheet.getCell("A3").value = dateRangeText;
    worksheet.getCell("A3").font = { italic: true, size: 12 };
    worksheet.getCell("A3").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(3).height = 20;

    worksheet.addRow([]);

    // Add headers
    const headers = [
      "Project ID",
      "Project Code",
      "Project Name",
      "Country Name",
      "Created At",
      "Total Respondents",
      "Test Link Count",
      ...Object.keys(LINK_STATUS_KEY).map(
        (key) => LINK_STATUS_KEY[key] + " Count"
      ),
      "Unknown Status Count",
    ];
    worksheet.addRow(headers);

    // Header styling
    const headerRow = worksheet.getRow(5);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E79" }, // Dark blue
    };
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" } };
    });

    // Add project data
    result.forEach((project, index) => {
      const row = [
        project.project_id,
        project.project_code,
        project.project_name,
        project.country_name,
        moment(project.created_at).format("YYYY-MM-DD"),
        project.total_respondents,
        project.test_link_count,
        ...Object.keys(LINK_STATUS_KEY).map(
          (status) => project[`${status}_count`] || 0
        ),
        project.unknown_status_count || 0,
      ];

      const dataRow = worksheet.addRow(row);
      dataRow.height = 20;

      // Alternating row colors
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFFFFFFF" : "FFF2F2F2" },
      };
    });

    // Auto-width columns and freeze header
    worksheet.columns.forEach((col) => (col.width = 20));
    worksheet.views = [{ state: "frozen", ySplit: 5 }];

    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error exporting projects" });
  }
};

module.exports = {
  searchSuppliers,
  getSupplierProjects,
  downloadSupplierReportExcel,
};
