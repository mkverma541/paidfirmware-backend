const { pool } = require("../../config/database");
const ExcelJS = require("exceljs");

const searchGroupProject = async (req, res) => {
  const { query } = req.query;

  try {
    const [data] = await pool.query(
      `SELECT gp.project_id, gp.project_code, gp.project_name
      FROM group_projects gp
      WHERE gp.project_name LIKE ? OR gp.project_code LIKE ?`,
      [`%${query}%`, `%${query}%`]
    );

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error fetching group project data:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};



async function getChildProjectReport(req, res) {
  try {
    const { project_id, page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    // Fetch data from the database with pagination and search
    const [data] = await pool.query(
      `SELECT pr.*, s.supplier_name, s.supplier_code, p.project_name, p.project_manager, p.project_code
       FROM project_report pr
       JOIN suppliers s ON pr.supplier_id = s.supplier_id
       JOIN projects p ON pr.project_id = p.project_id
       WHERE pr.project_id = ? AND (s.supplier_name LIKE ? OR pr.status_description LIKE ?)
       LIMIT ? OFFSET ?`,
      [project_id, `%${search}%`, `%${search}%`, parseInt(limit), parseInt(offset)]
    );

    // Fetch total count for pagination
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total
       FROM project_report pr
       JOIN suppliers s ON pr.supplier_id = s.supplier_id
       JOIN projects p ON pr.project_id = p.project_id
       WHERE pr.project_id = ? AND (s.supplier_name LIKE ? OR pr.status_description LIKE ?)`,
      [project_id, `%${search}%`, `%${search}%`]
    );

    if (data.length === 0) {
      return res.status(404).json({ message: "No data found for this project." });
    }

    res.json({
      success: true,
      data: data,
      pagination: {
        currentPage: parseInt(page),
        perPage: parseInt(limit),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error("Error fetching report data:", error);
    res.status(500).json({ message: "Error fetching report data." });
  }
}

const getList = async (req, res) => {
  try {
    const { project_id } = req.query;
    console.log("Received project_id:", project_id);

    const [data] = await pool.query(
      `SELECT p.*, c.name as country_name, 
              (SELECT COUNT(*) FROM project_report WHERE project_id = p.project_id) AS report_count 
       FROM projects p
       JOIN countries c ON p.country_code = c.code
       WHERE p.group_project_id = ?`,
      [project_id]
    );

    console.log("Query result:", data);

    if (data.length === 0) {
      return res.status(404).json({ success: false, message: "No data found" });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching project data:", error);
    res
      .status(500)
      .json({ success: false, message: "An unexpected error occurred." });
  }
};

const downloadInExcel = async (req, res) => {
  try {
    const { project_id } = req.query;
    console.log("Received project_id:", project_id);

    // Fetch data from the database
    const [data] = await pool.query(
      `SELECT pr.*, s.supplier_name, s.supplier_code, p.project_name, p.project_manager, p.project_code
       FROM project_report pr
       JOIN suppliers s ON pr.supplier_id = s.supplier_id
       JOIN projects p ON pr.project_id = p.project_id
       WHERE pr.project_id = ?`,
      [project_id]
    );

    console.log("Data:", data);

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // **1️⃣ Summary Sheet**
    const summarySheet = workbook.addWorksheet("Summary");

    // If data exists, group by status
    let summaryData = {};
    let project = {};

    if (data.length > 0) {
      project = data[0]; // Use first row to get project details
      summaryData = data.reduce((acc, row) => {
        acc[row.status_description] = (acc[row.status_description] || 0) + 1;
        return acc;
      }, {});
    }

    // Add Title
    summarySheet.mergeCells("A1:B1");
    summarySheet.getCell("A1").value = "Project Report";
    summarySheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "6461FF" } };
    summarySheet.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };

    // Add Project Name & Manager (Handle when data is empty)
    summarySheet.mergeCells("A2:B2");
    summarySheet.getCell("A2").value = data.length > 0 
      ? `Project Name: ${project.project_name} (Survey Code: ${project.project_code})`
      : "No Project Data Available";
    summarySheet.getCell("A2").font = { bold: true, size: 14, color: { argb: "6461FF" } };
    summarySheet.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };

    summarySheet.mergeCells("A3:B3");
    summarySheet.getCell("A3").value = data.length > 0 ? `Project Manager: ${project.project_manager}` : "";
    summarySheet.getCell("A3").font = { bold: true, size: 12 };
    summarySheet.getCell("A3").alignment = { horizontal: "left", vertical: "middle" };

    summarySheet.addRow([]); // Empty row for spacing

    // Headers for Summary Table
    const headerRow = summarySheet.addRow(["Respondent Status", "Count"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "6461FF" } };
    headerRow.alignment = { horizontal: "left", vertical: "middle" };

    // Add Summary Data or Blank Row if No Data
    if (data.length > 0) {
      Object.entries(summaryData).forEach(([status, count]) => {
        summarySheet.addRow([status, count]);
      });
    } else {
      summarySheet.addRow(["No Data Available", ""]);
    }

    summarySheet.columns.forEach(column => {
      column.width = column.header ? column.header.length + 15 : 20;
    });

    summarySheet.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {}; // No borders
      });
    });

    // **2️⃣ Detailed Data Sheet**
    const detailSheet = workbook.addWorksheet("Project Report");

    const headers = [
      "S.No.",
      "Supplier Id",
      "Supplier Name",
      "Supplier Identifier",
      "Supplier User Id",
      "Hash Identifier",
      "Project CPI",
      "Supplier CPI",
      "Status Description",
      "Failure Reason",
      "Start Date Time",
      "End Date Time",
      "LOI",
      "IP Address",
      "Country",
      "Device Type",
      "Browser Detail",
      "Test Link",
    ];

    const detailHeaderRow = detailSheet.addRow(headers);
    detailHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "6461FF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    detailHeaderRow.height = 25;

    // Add Data Rows if Available, Else Add Blank Row
    if (data.length > 0) {
      data.forEach((row, index) => {
        const addedRow = detailSheet.addRow([
          index + 1,
          row.supplier_id,
          row.supplier_name,
          row.supplier_identifier,
          row.supplier_user_id,
          row.hash_identifier,
          row.project_cpi,
          row.supplier_cpi,
          row.status_description,
          row.failure_reason,
          row.start_date_time,
          row.end_date_time,
          row.loi,
          row.ip_address,
          row.country,
          row.device_type,
          row.browser_detail,
          row.test_link === 1 ? "Yes" : "No",
        ]);
        addedRow.height = 20;
        addedRow.alignment = { horizontal: "center", vertical: "middle" };
      });
    } else {
      detailSheet.addRow(["No Data Available"]);
    }

    detailSheet.columns.forEach(column => {
      column.width = column.header ? column.header.length + 10 : 20;
    });

    detailSheet.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: "thin", color: { argb: "D3D3D3" } },
          left: { style: "thin", color: { argb: "D3D3D3" } },
          bottom: { style: "thin", color: { argb: "D3D3D3" } },
          right: { style: "thin", color: { argb: "D3D3D3" } },
        };
      });
    });

    // Set response headers
    res.setHeader("Content-Disposition", 'attachment; filename="ProjectReport.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Error generating the report.");
  }
};

module.exports = {
  getList,
  searchGroupProject,
  downloadInExcel,
  getChildProjectReport,
};
