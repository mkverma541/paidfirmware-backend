const { pool } = require("../../config/database");
const ExcelJS = require("exceljs");
const moment = require("moment");

const { LINK_STATUS_KEY } = require("../utils/constants");

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

const getProjectReport = async (req, res) => {
  try {
    const { project_id } = req.query;

    // Fetch project details along with country name
    const [data] = await pool.query(
      `SELECT p.*, c.name as country_name 
       FROM projects p
       JOIN countries c ON p.country_code = c.code
       WHERE p.group_project_id = ?`,
      [project_id]
    );

    if (data.length === 0) {
      return res.status(404).json({ success: false, message: "No data found" });
    }

    const projectIds = data.map((p) => p.project_id);

    // Get total report count
    const [reportCounts] = await pool.query(
      `SELECT project_id, COUNT(*) AS report_count 
       FROM project_report 
       WHERE project_id IN (?) 
       GROUP BY project_id`,
      [projectIds]
    );

    // Get status counts
    const [statusCounts] = await pool.query(
      `SELECT project_id, status, COUNT(*) as count 
       FROM project_report 
       WHERE project_id IN (?) 
       GROUP BY project_id, status`,
      [projectIds]
    );

    // Create lookup maps
    const reportCountMap = new Map();
    reportCounts.forEach((row) => {
      reportCountMap.set(row.project_id, row.report_count);
    });

    const statusCountsMap = new Map();
    statusCounts.forEach((row) => {
      if (!statusCountsMap.has(row.project_id)) {
        statusCountsMap.set(row.project_id, {});
      }
      statusCountsMap.get(row.project_id)[row.status] = row.count;
    });

    // Merge the data
    const result = data.map((project) => {
      const report_count = reportCountMap.get(project.project_id) || 0;
      const statuses = statusCountsMap.get(project.project_id) || {};

      // Initialize all status counts
      const allStatusCounts = {};
      Object.keys(LINK_STATUS_KEY).forEach((status) => {
        allStatusCounts[`${status}_count`] = statuses[status] || 0;
      });
      allStatusCounts.unknown_status_count = statuses[null] || 0;

      return {
        ...project,
        report_count,
        ...allStatusCounts,
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching project data:", error);
    res
      .status(500)
      .json({ success: false, message: "An unexpected error occurred." });
  }
};

const downloadProjectReport = async (req, res) => {
  try {
    const { project_id } = req.query;

    const [data] = await pool.query(
      `SELECT pr.*, s.supplier_name, s.supplier_code, p.project_name, p.project_manager, p.project_code, c.name as country
       FROM project_report pr
       JOIN suppliers s ON pr.supplier_id = s.supplier_id
       JOIN projects p ON pr.project_id = p.project_id
       JOIN countries c ON pr.country_code = c.code
       WHERE pr.project_id = ?`,
      [project_id]
    );

    const workbook = new ExcelJS.Workbook();

    // ✅ Summary Sheet Styling
    const summarySheet = workbook.addWorksheet("Summary");

    let summaryData = {};
    let project = {};
    let testLinkCount = 0;

    if (data.length > 0) {
      project = data[0];
      summaryData = data.reduce((acc, row) => {
        const status = row.status || "";
        acc[status] = (acc[status] || 0) + 1;

        if (row.test_link == 1) {
          testLinkCount++;
        }
        return acc;
      }, {});
    }

    // ✅ Summary Sheet Title and Project Info
    summarySheet.mergeCells("A1:B1");
    summarySheet.getCell("A1").value = "Project Report";
    summarySheet.getCell("A1").font = {
      bold: true,
      size: 18,
      color: { argb: "2F75B5" },
    };
    summarySheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    summarySheet.mergeCells("A2:B2");
    summarySheet.getCell("A2").value =
      data.length > 0
        ? `Project Name: ${project.project_name} (Survey Code: ${project.project_code})`
        : "No Project Data Available";
    summarySheet.getCell("A2").font = {
      bold: true,
      size: 14,
      color: { argb: "2F75B5" },
    };
    summarySheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    summarySheet.mergeCells("A3:B3");
    summarySheet.getCell("A3").value =
      data.length > 0 ? `Project Manager: ${project.project_manager}` : "";
    summarySheet.getCell("A3").font = { bold: true, size: 12 };
    summarySheet.getCell("A3").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    summarySheet.addRow([]);

    // ✅ Summary Sheet Headers
    const headerRow = summarySheet.addRow(["Respondent Status", "Count"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "2F75B5" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.border = { bottom: { style: "thin", color: { argb: "000000" } } };

    // ✅ Populate Summary Data
    if (data.length > 0) {
 
      Object.entries(summaryData).forEach(([status, count]) => {
        const mappedStatus = LINK_STATUS_KEY[status] || status;
        summarySheet.addRow([mappedStatus, count]);
      });

      summarySheet.addRow(["Test Link", testLinkCount]);
    } else {
      summarySheet.addRow(["No Data Available", ""]);
    }

    summarySheet.columns.forEach((column) => {
      column.width = column.header ? column.header.length + 10 : 20;
    });

    summarySheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = { bottom: { style: "thin", color: { argb: "D3D3D3" } } };
      });
    });

    // ✅ Detail Sheet Styling
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
      "Status",
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
    detailHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "2F75B5" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "000000" } } };
    });

    detailHeaderRow.height = 25;

    // ✅ Populate Detail Data
    if (data.length > 0) {
      data.forEach((row, index) => {
        const addedRow = detailSheet.addRow([
          index + 1,
          row.supplier_code,
          row.supplier_name,
          row.supplier_identifier,
          row.supplier_user_id,
          row.hash_identifier,
          row.project_cpi,
          row.supplier_cpi,
          LINK_STATUS_KEY[row.status] || row.status, // Use corrected mapping
          row.failure_reason,
          row.start_date_time,
          row.end_date_time,
          row.loi,
          row.ip_address,
          row.country,
          row.device_type,
          row.browser_agent,
          row.test_link == 1 ? "Yes" : "No",
        ]);

        addedRow.height = 20;
        addedRow.alignment = { horizontal: "center", vertical: "middle" };

        if (index % 2 === 0) {
          addedRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F2F2F2" },
          };
        }
      });
    } else {
      detailSheet.addRow(["No Data Available"]);
    }

    detailSheet.columns.forEach((column) => {
      column.width = column.header ? column.header.length + 10 : 20;
    });

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

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="ProjectReport.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Error generating the report.");
  }
};

const downloadGroupProjectReport = async (req, res) => {
  try {
    const { project_id } = req.query;

    // Fetch project details along with country name
    const [data] = await pool.query(
      `SELECT p.*, c.name as country_name 
       FROM projects p
       JOIN countries c ON p.country_code = c.code
       WHERE p.group_project_id = ?`,
      [project_id]
    );

    if (data.length === 0) {
      return res.status(404).json({ success: false, message: "No data found" });
    }

    const projectIds = data.map((p) => p.project_id);

    // Get total report count
    const [reportCounts] = await pool.query(
      `SELECT project_id, COUNT(*) AS report_count 
       FROM project_report 
       WHERE project_id IN (?) 
       GROUP BY project_id`,
      [projectIds]
    );

    // Get status counts
    const [statusCounts] = await pool.query(
      `SELECT project_id, status, COUNT(*) as count 
       FROM project_report 
       WHERE project_id IN (?) 
       GROUP BY project_id, status`,
      [projectIds]
    );

    // Create lookup maps
    const reportCountMap = new Map();
    reportCounts.forEach((row) => {
      reportCountMap.set(row.project_id, row.report_count);
    });

    const statusCountsMap = new Map();
    statusCounts.forEach((row) => {
      if (!statusCountsMap.has(row.project_id)) {
        statusCountsMap.set(row.project_id, {});
      }
      statusCountsMap.get(row.project_id)[row.status] = row.count;
    });

    // Merge the data
    const result = data.map((project) => {
      const report_count = reportCountMap.get(project.project_id) || 0;
      const statuses = statusCountsMap.get(project.project_id) || {};

      // Initialize all status counts
      const allStatusCounts = {};
      Object.keys(LINK_STATUS_KEY).forEach((status) => {
        allStatusCounts[`${status}_count`] = statuses[status] || 0;
      });
      allStatusCounts.unknown_status_count = statuses[null] || 0;

      return {
        ...project,
        report_count,
        ...allStatusCounts,
      };
    });

    // 🛠️ Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Project Report");

    // File name with date
    const fileName = `Project_Report_${moment().format("YYYY-MM-DD")}.xlsx`;

    // 🎯 Add Report Header
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = `Project Report Summary`;
    worksheet.getCell("A1").font = { bold: true, size: 18 };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(1).height = 30;

    worksheet.addRow([]);

    // 🎯 Add headers
    const headers = [
      "Project ID",
      "Project Code",
      "Project Name",
      "Country Name",
      "Created At",
      "Total Reports",
      ...Object.keys(LINK_STATUS_KEY).map((key) => LINK_STATUS_KEY[key] + " Count"),
      "Unknown Status Count",
    ];
    worksheet.addRow(headers);

    // Header styling
    const headerRow = worksheet.getRow(3);
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

    // 🎯 Add project data
    result.forEach((project, index) => {
      const row = [
        project.project_id,
        project.project_code,
        project.project_name,
        project.country_name,
        moment(project.created_at).format("YYYY-MM-DD"),
        project.report_count,
        ...Object.keys(LINK_STATUS_KEY).map((status) => project[`${status}_count`] || 0),
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
    worksheet.views = [{ state: "frozen", ySplit: 3 }];

    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting project report:", error);
    res.status(500).json({ success: false, message: "Error exporting projects" });
  }
};



module.exports = {
  getProjectReport,
  searchGroupProject,
  downloadProjectReport,
  downloadGroupProjectReport,
};
