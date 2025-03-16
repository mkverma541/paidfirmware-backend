const { pool } = require("../config/database");
const ExcelJS = require("exceljs");

const generateProjectReport = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Fetch data from the database
    const [data] = await pool.query(
      `SELECT pr.*, s.supplier_name, p.project_name, p.project_manager, p.project_code
       FROM project_report pr
       JOIN suppliers s ON pr.supplier_id = s.supplier_id
       JOIN projects p ON pr.project_id = p.project_id
       WHERE pr.project_id = ?`,
      [projectId]
    );

    const project = data[0];

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // **1️⃣ Summary Sheet (First Sheet)**
    const summarySheet = workbook.addWorksheet("Summary");

    // Group data by "status_description"
    const summaryData = data.reduce((acc, row) => {
      acc[row.status_description] = (acc[row.status_description] || 0) + 1;
      return acc;
    }, {});

    // Add Title
    summarySheet.mergeCells("A1:B1");
    const titleCell = summarySheet.getCell("A1");
    titleCell.value = "Project Report";
    titleCell.font = { bold: true, size: 16, color: { argb: "6461FF" } }; // Brand color
    titleCell.alignment = { horizontal: "left", vertical: "middle" }; // Align left

    // Add Project Name & Manager
    summarySheet.mergeCells("A2:B2");
    const projectNameCell = summarySheet.getCell("A2");
    projectNameCell.value = `Project Name: ${project.project_name} (Survey Code: ${project.project_code})`;
    projectNameCell.font = { bold: true, size: 14, color: { argb: "6461FF" } }; // Brand color
    projectNameCell.alignment = { horizontal: "left", vertical: "middle" }; // Align left

    summarySheet.mergeCells("A3:B3");
    const projectManagerCell = summarySheet.getCell("A3");
    projectManagerCell.value = `Project Manager: ${project.project_manager}`;
    projectManagerCell.font = { bold: true, size: 12 };
    projectManagerCell.alignment = { horizontal: "left", vertical: "middle" }; // Align left

    // Add some spacing
    summarySheet.addRow([]); // Empty row for spacing

    // Headers for Summary Table
    const headerRow = summarySheet.addRow(["Respondent Status", "Count"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }; // White text
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "6461FF" },
    }; // Brand color
    headerRow.alignment = { horizontal: "left", vertical: "middle" }; // Align left

    // Add Summary Data
    Object.entries(summaryData).forEach(([status, count]) => {
      const row = summarySheet.addRow([status, count]);
      row.font = { size: 12 }; // Adjust font size
      row.alignment = { horizontal: "left", vertical: "middle" }; // Align left
    });

    // Auto-adjust column widths
    summarySheet.columns.forEach((column) => {
      column.width = column.header ? column.header.length + 15 : 20; // Wider columns
    });

    // Remove borders from the Summary Sheet
    summarySheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {}; // No borders
      });
    });

    // **2️⃣ Detailed Data Sheet (Second Sheet)**
    const detailSheet = workbook.addWorksheet("Project Report");

    // Define Headers
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

    // Style Header Row
    const detailHeaderRow = detailSheet.addRow(headers);
    detailHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "6461FF" },
      }; // Brand color
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Increase header row height
    detailHeaderRow.height = 25;

    // Add Data Rows
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

    // Auto-fit column width
    detailSheet.columns.forEach((column) => {
      column.width = column.header ? column.header.length + 10 : 20;
    });

    // Apply borders to Detailed Report
    detailSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "D3D3D3" } },
          left: { style: "thin", color: { argb: "D3D3D3" } },
          bottom: { style: "thin", color: { argb: "D3D3D3" } },
          right: { style: "thin", color: { argb: "D3D3D3" } },
        };
      });
    });

    // Set response headers
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="ProjectReport.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Write the workbook to a buffer and send it
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Error generating the report.");
  }
};

module.exports = { generateProjectReport };
