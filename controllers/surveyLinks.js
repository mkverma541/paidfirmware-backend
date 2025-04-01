const { pool } = require("../config/database");
const axios = require("axios");
const requestIp = require("request-ip");
const { v4: uuidv4 } = require("uuid");
const UAParser = require("ua-parser-js");

async function getRedirectLinks(req, res) {
  try {
    const { uid, end } = req.body;

    if (!uid && !end) {
      return res
        .status(400)
        .json({ message: "uid or end is required", status: "error" });
    }

    if (end) {
      const query = `
        SELECT * 
        FROM project_report 
        WHERE hash_identifier = ?`;

      const [result] = await pool.query(query, [uid]);

      if (result.length === 0) {
        return res
          .status(200)
          .json({ message: "Identifier does not exist.", status: "success" });
      }

      const data = result[0];

      const statusMap = {
        10: {
          status: "complete",
          page: "c",
        },
        20: {
          status: "terminate",
          page: "f",
        },
        30: {
          status: "qualiy_terminate",
          page: "t",
        },
        40: {
          status: "over_quota",
          page: "q",
        },
        70: {
          status: "survey_closed",
          page: "sc",
        },
      };

      const query2 = `
          UPDATE project_report
          SET end_date_time = NOW(), status = ?
          WHERE hash_identifier = ?`;

      await pool.query(query2, [statusMap[end].status, uid]);

      return res.status(200).json({
        message: statusMap[end].response,
        status: "success",
        redirectLink: `${process.env.APP_BASE_URL}/Thanks/Verify?end=${statusMap[end].page}&uid=${uid}`,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function getSurveyLinks(req, res) {
  // 1. Get original identifiers from the request
  const { stid, uid: originalUid } = req.body; // Rename to avoid confusion

  try {
    // 2. Basic validation
    if (!stid || !originalUid) {
      return res
        .status(400)
        .json({ message: "stid or uid is required", status: "error" });
    }

    // 3. Fetch supplier details
    const [suppliers] = await pool.query(
      `SELECT * FROM project_suppliers WHERE stid = ?`,
      [stid]
    );
    if (suppliers.length === 0) {
      return res
        .status(404)
        .json({ message: "Supplier not found", status: "error" });
    }
    const supplierDetails = suppliers[0];
    const isTestLink = supplierDetails.is_test_link; // 1 for test link, 0 for actual link

    // 4. Fetch project details
    const [project] = await pool.query(
      `SELECT * FROM projects WHERE project_id = ?`,
      [supplierDetails.project_id]
    );
    if (project.length === 0) {
      return res
        .status(404)
        .json({ message: "Project not found", status: "error" });
    }
    const projectDetails = project[0];

    // 5. Gather request context
    const ipAddress = getClientIp(req);
    const { deviceType, browser } = getDeviceAndBrowserDetails(req);
    const country = await getCountryDetails(ipAddress); // Assuming this returns country code/name

    // 6. Prepare parameters for logging (using originalUid)
    const baseParams = {
      supplierDetails,
      projectDetails,
      uid: originalUid, // Use the original UID from the request
      hashIdentifier: "", // Will be set later
      projectCPI: 0, // Assuming these might be fetched/calculated later
      supplierCPI: 0,
      ipAddress,
      country,
      deviceType,
      browser,
      isTestLink,
    };

    // 7. Determine status and redirect link
    let status = ""; // Default status before checks
    let redirectLinks = `${process.env.APP_BASE_URL}/Survey/Success?uid=${originalUid}`; // Default success link
    let hashIdentifier = ""; // Initialize hashIdentifier

    if (isTestLink === 0) {
      // Live Link Logic
      // Check conditions sequentially
      if (await checkDuplicateSupplierUser(originalUid, stid)) {
        status = "duplicate_supplier_user";
        redirectLinks = `${process.env.APP_BASE_URL}/Thanks/Verify?end=f&uid=${originalUid}`;
      } else if (projectDetails.country_code !== country) {
        // Ensure comparison is correct (e.g., both are country codes)
        status = "geo_ip_mismatch";
        redirectLinks = `${process.env.APP_BASE_URL}/Thanks/Verify?end=f&uid=${originalUid}`;
      } else if (await checkDuplicateIP(ipAddress)) {
        status = "duplicate_ip";
        redirectLinks = `${process.env.APP_BASE_URL}/Thanks/Verify?end=f&uid=${originalUid}`;
      } else {
        // Passed all checks, generate link
        const liveLink = projectDetails.survey_live_link;
        const hash = uuidv4();
        hashIdentifier = `ADR-${hash}`;
        redirectLinks = liveLink.replace("[identifier]", hashIdentifier);
        // Status remains 'Success' until survey interaction changes it,
        // but we often log the initial entry as something like 'Sent to Survey' or keep 'Success' for entry.
        // The original code set it to 'Drop Out' here, which might be premature. Let's use 'Sent to Survey'.
        status = "Drop Out"; // Need to verify client
      }
    } else {
      // Test Link Logic
      const testLink = projectDetails.survey_test_link;
      const hash = uuidv4();
      hashIdentifier = `ADR-${hash}`;
      // No need to generate or overwrite uid here. Use the hashIdentifier for the link.
      redirectLinks = testLink.replace("[identifier]", hashIdentifier);
      // The original code set status to 'Drop Out', let's use 'Sent to Test Survey'.
      status = "drop_out";
    }

    // 8. Log the outcome
    const logParams = {
      ...baseParams,
      status,
      hashIdentifier, // Ensure hashIdentifier is included
    };
    await logProjectReport(logParams); // Pass the final parameters

    // 9. Return the result
    return res.status(200).json({
      status: "success", // API call status
      link: redirectLinks,
    });
  } catch (err) {
    console.error("Error in getSurveyLinks:", err); // Log the specific error
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function testSurveyLinks(req, res) {
  try {
    const { project_id } = req.body;

    const query = `SELECT * FROM project_suppliers WHERE project_id = ?`;

    const [suppliers] = await pool.query(query, [project_id]);

    const stid = suppliers[0].stid;

    if (suppliers.length === 0) {
      return res
        .status(404)
        .json({ message: "Suppliers not found", status: "error" });
    }

    const uid = uuidv4();

    res.status(200).json({
      status: "success",
      link: `${process.env.APP_BASE_URL}/Survey?stid=${stid}&uid=${uid}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

function getClientIp(req) {
  let ipAddress = requestIp.getClientIp(req) || "";
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "152.59.98.114"; // Use Google's DNS IP for testing
  }
  return ipAddress;
}

function getDeviceAndBrowserDetails(req) {
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    deviceType: result.device.type || "Desktop",
    browser: `${result.browser.name}_${result.browser.version}`,
  };
}

async function getCountryDetails(ipAddress) {
  try {
    const geoResponse = await axios.get(`https://ipinfo.io/${ipAddress}/json`);
    return geoResponse.data.country || "";
  } catch (geoError) {
    console.error("Error fetching country details:", geoError);
    return "";
  }
}
async function getCountryDetails(ipAddress) {
  try {
    const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`);
    return response.data.country_code || "";
  } catch (error) {
    console.error("Error fetching country details:", error);
    return "";
  }
}

async function checkDuplicateIP(ipAddress) {
  const query = `SELECT * FROM project_report WHERE ip_address = ?`;
  const [result] = await pool.query(query, [ipAddress]);
  return result.length > 0;
}

async function checkDuplicateSupplierUser(uid, stid) {
  const query = `SELECT * FROM project_report WHERE supplier_identifier = ? AND stid = ?`;
  const [result] = await pool.query(query, [uid, stid]);
  return result.length > 0;
}

async function logProjectReport({
  supplierDetails,
  projectDetails,
  uid,
  hashIdentifier,
  projectCPI,
  supplierCPI,
  status,
  ipAddress,
  country,
  deviceType,
  browser,
  isTestLink,
}) {
  const logQuery = `INSERT INTO project_report (supplier_id, project_id, stid, supplier_identifier, supplier_user_id, hash_identifier, project_cpi, supplier_cpi, status, failure_reason,  end_date_time, loi, ip_address, country_code, device_type, browser_agent, test_link) VALUES ?`;

  const hashString = normalizeHash(hashIdentifier);

  const logData = [
    [
      supplierDetails.supplier_id,
      projectDetails.project_id,
      supplierDetails.stid,
      uid,
      "",
      hashString,
      projectCPI,
      supplierCPI,
      status,
      "",
      null,
      "",
      ipAddress,
      country,
      deviceType,
      browser,
      isTestLink,
    ],
  ];

  await pool.query(logQuery, [logData]);
}

function normalizeHash(hash) {
  if (!hash) return "";
  return hash
    .toString() // Ensure it's a string
    .trim() // Remove whitespace
    .normalize("NFKC") // Normalize Unicode
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    .replace(/[^\x20-\x7E]/g, ""); // Remove non-ASCII characters (optional)
}

module.exports = { getSurveyLinks, getRedirectLinks, testSurveyLinks };
