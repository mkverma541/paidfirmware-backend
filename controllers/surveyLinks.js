const { pool } = require("../config/database");
const axios = require("axios");
const requestIp = require("request-ip");
const parser = require("ua-parser-js");
const { v4: uuidv4 } = require("uuid");

async function getRedirectLinks(req, res) {
  try {
    const { uid, end } = req.body;

    if (!uid && !end) {
      return res
        .status(400)
        .json({ message: "uid or end is required", status: "error" });
    }

    if (end) {
      // Fetch the record based on the identifier
      const query = `SELECT * FROM project_report WHERE hash_identifier = ?`;
      const [result] = await pool.query(query, [end]);

      if (result.length === 0) {
        return res
          .status(200)
          .json({ message: "Identifier does not exist.", status: "success" });
      }

      const data = result[0];

      // Handle statuses
      const statusMap = {
        10: {
          status: "completed",
          response:
            "You have completed this survey successfully. Your participation status will be updated soon!",
        },
        20: {
          status: "terminated",
          response: "However, you are not eligible for this survey.",
        },
        30: {
          status: "quality_terminate",
          response: "However, you are not eligible for this survey.",
        },
        40: {
          status: "over_quota",
          response:
            "We have got the required number of responses. We look forward to your participation in other surveys.",
        },
        70: {
          status: "survey_close",
          response:
            "However, the survey has been closed. We look forward to your participation in other surveys.",
        },
      };

      if (statusMap[end]) {
        if (data.end_date_time === null) {
          const query2 = `
            UPDATE project_report
            SET end_date_time = NOW(), status = ?
            WHERE hash_identifier = ?`;

          await pool.query(query2, [statusMap[end].status, end]);

          return res
            .status(200)
            .json({ message: statusMap[end].response, status: "success" });
        } else {
          return res
            .status(409)
            .json({ message: "Project already ended.", status: "error" });
        }
      } else {
        return res
          .status(400)
          .json({ message: "Invalid end status.", status: "error" });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function testSurveyLinks(req, res) {
  const { project_id } = req.body;

  try {
    if (!project_id) {
      return res
        .status(400)
        .json({ message: "project_id is required", status: "error" });
    }

    // Fetch the project details based on the project_id
    const query = `SELECT * FROM projects WHERE project_id = ?`;
    const [project] = await pool.query(query, [project_id]);

    if (project.length === 0) {
      return res
        .status(404)
        .json({ message: "Project not found", status: "error" });
    }

    const ipAddress = getClientIp(req); // Get the client's IP address
    const { deviceType, browser } = getDeviceAndBrowserDetails(req); // Get device and browser details
    const country = await getCountryDetails(ipAddress); // Get country details
    const isDuplicateIp = await checkDuplicateIP(ipAddress); // Check duplicate IP

    // Fix SQL query syntax for fetching supplier details
    const supplierQuery = `SELECT * FROM project_suppliers WHERE project_id = ?`;
    const [supplierDetails] = await pool.query(supplierQuery, [project_id]);

    if (supplierDetails.length === 0) {
      return res
        .status(404)
        .json({ message: "Supplier not found", status: "error" });
    }

    // Generate random uid format
    const uid = uuidv4();
    let status = "";
    let redirectLinks;

    const params = {
      supplierDetails: supplierDetails[0],
      projectDetails: project[0],
      uid: uid,
      hashIdentifier: "",
      projectCPI: 0,
      supplierCPI: 0,
      ipAddress: ipAddress,
      country: country,
      deviceType: deviceType,
      browser: browser,
      isTestLink: 1,
    };

    if (isDuplicateIp) {
      status = "Duplicate IP";
      redirectLinks = `${process.env.APP_BASE_URL}/Thanks/Verify?end=f&uid=${uid}`; // Fail
    }

    const isDuplicateSupplierUser = await checkDuplicateSupplierUser(uid);

    if (isDuplicateSupplierUser) {
      status = "Duplicate Supplier User";
      redirectLinks = `${process.env.APP_BASE_URL}/Thanks/Verify?end=f&uid=${uid}`; // Fail
    }

    await logProjectReport({
      ...params,
      status: status,
    });

    console.log(redirectLinks);
    res.status(200).json({
      status: "success",
      link: redirectLinks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function getSurveyLinks(req, res) {
  try {
    const { stid, uid } = req.body;

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
  console.log(uid);
  let status = "";
  let redirectLink = `${process.env.APP_BASE_URL}/Thanks/Verify?end=f&uid=${uid}`;

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
  const query = `SELECT * FROM project_report WHERE supplier_identifier = ?`;
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

module.exports = { getSurveyLinks, getRedirectLinks, testSurveyLinks };
