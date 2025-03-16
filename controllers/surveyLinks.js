const { pool } = require("../config/database");
const axios = require("axios");
const requestIp = require("request-ip");
const parser = require("ua-parser-js");
const { v4: uuidv4 } = require("uuid");

async function getSurveyLinks(req, res) {
  try {
    const { stid, uid } = req.body;

    // Validate input
    if (!stid) {
      return res
        .status(400)
        .json({ message: "stid is required", status: "error" });
    }

    const supplierDetails = await getSupplierDetails(stid);
    if (!supplierDetails) {
      return res
        .status(404)
        .json({ message: "No survey links found", status: "error" });
    }

    const projectDetails = await getProjectDetails(supplierDetails.project_id);
    if (!projectDetails) {
      return res
        .status(404)
        .json({ message: "Project not found", status: "error" });
    }

    const ipAddress = getClientIp(req);
    const { deviceType, browser } = getDeviceAndBrowserDetails(req);
    const country = await getCountryDetails(ipAddress);

    const { status, redirectLink } = await performChecks(
      uid,
      ipAddress,
      country,
      projectDetails
    );

    let hashIdentifier = "";
    let supplierCPI = 0;
    let projectCPI = 0;

    // If all checks pass, update supplier_cpi and project_cpi
    if (!status) {
      supplierCPI = supplierDetails.supplier_cpi;
      projectCPI = projectDetails.project_cpi;
      hashIdentifier = `AC-${uuidv4()}`;
    }

    // Log data in project_report regardless of checks
    await logProjectReport({
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
      isTestLink: supplierDetails.is_test_link,
    });

    console.log(status);  

    // If checks fail, return the redirect link with the appropriate status
    if (status) {
      return res.status(200).json({
        message: "Survey links fetched successfully",
        status: "success",
        link: redirectLink,
      });
    }

    // If all checks pass, return the final survey link
    const finalRedirectLink = `${projectDetails.survey_live_link}?uid=${hashIdentifier}`;

    res.status(200).json({
      message: "Survey links fetched successfully",
      status: "success",
      link: finalRedirectLink,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function getSupplierDetails(stid) {
  const query = `SELECT * FROM project_suppliers WHERE stid = ?;`;
  const [result] = await pool.query(query, [stid]);
  return result[0];
}

async function getProjectDetails(projectId) {
  const query = `SELECT * FROM projects WHERE project_id = ?;`;
  const [result] = await pool.query(query, [projectId]);
  return result[0];
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
  const parsedUA = parser(userAgent);
  return {
    deviceType: parsedUA.device.type || "",
    browser: parsedUA.browser.name || "",
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

/**
 * Performs various checks to determine the status and redirect link based on the provided parameters.
 *
 * @param {string} uid - The unique identifier for the user.
 * @param {string} ipAddress - The IP address of the user.
 * @param {string} country - The country code of the user.
 * @param {Object} projectDetails - The details of the project.
 * @param {number} projectDetails.is_geo_location - Indicates if geo-location check is required (1 for true, 0 for false).
 * @param {string} projectDetails.country_code - The country code specified in the project details.
 * @returns {Promise<Object>} An object containing the status and redirect link.
 * @returns {string} return.status - The status of the checks performed.
 * @returns {string} return.redirectLink - The URL to redirect the user based on the checks.
 */

async function performChecks(uid, ipAddress, country, projectDetails) {
    console.log(uid)
    let status = "";
    let redirectLink = `${process.env.APP_BASE_URL}/Thanks/Verify?end=f&uid=${uid}`

    // Check for duplicate IP address
    const isDuplicateIP = await checkDuplicateIP(ipAddress);
    if (isDuplicateIP) {
        status = "Duplicate IP";
    }

    // Check for duplicate supplier user
    const isDuplicateSupplierUser = await checkDuplicateSupplierUser(uid);
    if (isDuplicateSupplierUser) {
        status = "Duplicate Supplier User";
    }

    // Check for geo-location mismatch
    if (
        projectDetails.is_geo_location === 1 &&
        projectDetails.country_code !== country
    ) {
        status = "Geo IP Mismatch";
    }

    console.log(redirectLink);

    return { status, redirectLink };
}

async function checkDuplicateIP(ipAddress) {
  const query = `SELECT * FROM project_report WHERE ip_address = ?`;
  const [result] = await pool.query(query, [ipAddress]);
  return result.length > 0;
}

async function checkDuplicateSupplierUser(uid) {
  const query = `SELECT * FROM project_report WHERE supplier_user_id = ?`;
  const [result] = await pool.query(query, [uid]);
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
  const logQuery = `INSERT INTO project_report (supplier_id, project_id, stid, supplier_identifier, supplier_user_id, hash_identifier, project_cpi, supplier_cpi, status_description, failure_reason,  end_date_time, loi, ip_address, country_code, device_type, browser_agent, test_link) VALUES ?`;

  const logData = [
    [
      supplierDetails.supplier_id,
      projectDetails.project_id,
      supplierDetails.stid,
      uid,
      "",
      hashIdentifier,
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



module.exports = { getSurveyLinks };
