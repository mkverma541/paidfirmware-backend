const { pool } = require("../../config/database");
const {
  PERIOD_UNITS_IN_SECONDS,
  BANDWIDTH_UNITS_IN_BYTES,
} = require("../utils/constants");

const Joi = require("joi"); // Assuming Joi is being used for validation

// Define your Joi validation schema
const packageSchema = Joi.object({
  title: Joi.string().required().messages({
    "string.empty": "Package title is required",
    "any.required": "Package title is required",
  }),
  description: Joi.string().required().messages({
    "string.empty": "Package description is required",
    "any.required": "Package description is required",
  }),
  price: Joi.number().positive().required().messages({
    "number.base": "Price must be a positive number",
    "any.required": "Price is required",
  }),
  // is_expirable by defualt false
  is_expirable: Joi.boolean().default(false),
  period: Joi.number().positive().required().messages({
    "number.base": "Period must be a positive number",
    "any.required": "Period is required",
  }),
  period_unit: Joi.string()
    .valid("seconds", "minutes", "hours", "days", "weeks", "months", "years")
    .required()
    .messages({
      "any.only":
        "Period unit must be one of the valid time units (e.g., 'seconds', 'minutes')",
      "any.required": "Period unit is required",
    }),
  limit_devices: Joi.boolean().required(),
  devices: Joi.number()
    .positive()
    .when("limit_devices", { is: true, then: Joi.required() }),
  is_public: Joi.boolean().required(),
  is_active: Joi.boolean().required(),
  is_bandwidth: Joi.boolean().default(false),
  is_bandwidth_limit_size: Joi.boolean().default(false),
  bandwidth: Joi.number()
    .positive()
    .when("is_bandwidth", { is: true, then: Joi.required() }),
  bandwidth_quota_unit: Joi.string()
    .valid("Bytes", "KB", "MB", "GB", "TB")
    .default("Bytes"),
  is_bandwidth_files: Joi.boolean().default(false),
  bandwidth_files: Joi.number().positive().default(0),
  bandwidth_feature: Joi.string().allow(null).default(null),
  is_fair: Joi.boolean().default(false),
  is_fair_limit_size: Joi.boolean().default(false),
  fair: Joi.number()
    .positive()
    .when("is_fair", { is: true, then: Joi.required() }),
  fair_quota_unit: Joi.string()
    .valid("Bytes", "KB", "MB", "GB", "TB")
    .default("Bytes"),
  is_fair_files: Joi.boolean().default(false),
  fair_files: Joi.number().positive().default(0),
  package_id: Joi.number().positive().optional(),
});

async function addPackage(req, res) {
  try {
    // Validate request body using Joi schema
    const { error } = packageSchema.validate(req.body, { abortEarly: false }); // Collect all errors
    if (error) {
      const errorMessages = error.details.map((detail) => detail.message); // Collect error messages
      return res.status(400).json({ errors: errorMessages }); // Return all validation errors
    }

    const {
      title,
      description,
      price,
      is_expirable,
      period: inputPeriod,
      period_unit,
      limit_devices,
      devices,
      is_public,
      is_active,
      is_bandwidth = false,
      is_bandwidth_limit_size = false,
      bandwidth: inputBandwidth = 0,
      bandwidth_quota_unit = "Bytes",
      is_bandwidth_files = false,
      bandwidth_files = 0,
      bandwidth_feature = null,
      is_fair = false,
      is_fair_limit_size = false,
      fair = 0,
      fair_quota_unit = "Bytes",
      is_fair_files = false,
      fair_files = 0,
    } = req.body;

    // Convert period to seconds using constants
    const periodInSeconds = PERIOD_UNITS_IN_SECONDS[period_unit]
      ? Number(inputPeriod) * PERIOD_UNITS_IN_SECONDS[period_unit]
      : 0;

    // Convert bandwidth to bytes using constants
    const bandwidthInBytes = BANDWIDTH_UNITS_IN_BYTES[bandwidth_quota_unit]
      ? Number(inputBandwidth) * BANDWIDTH_UNITS_IN_BYTES[bandwidth_quota_unit]
      : 0;

    // Convert fair to bytes using constants
    const fairInBytes = BANDWIDTH_UNITS_IN_BYTES[fair_quota_unit]
      ? Number(fair) * BANDWIDTH_UNITS_IN_BYTES[fair_quota_unit]
      : 0;

    // Insert into the database
    const [result] = await pool.execute(
      `INSERT INTO res_download_packages 
      (title, description, price, is_expirable, period, period_unit, limit_devices, devices, is_public, is_active, 
      is_bandwidth, is_bandwidth_limit_size, bandwidth, bandwidth_quota_unit, 
      is_bandwidth_files, bandwidth_files, bandwidth_feature, 
      is_fair, is_fair_limit_size, fair, fair_quota_unit, is_fair_files, fair_files) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description,
        price,
        is_expirable,
        periodInSeconds,
        period_unit,
        limit_devices,
        devices,
        is_public,
        is_active,
        is_bandwidth,
        is_bandwidth_limit_size,
        bandwidthInBytes,
        bandwidth_quota_unit,
        is_bandwidth_files,
        bandwidth_files,
        bandwidth_feature,
        is_fair,
        is_fair_limit_size,
        fairInBytes,
        fair_quota_unit,
        is_fair_files,
        fair_files,
      ]
    );

    return res.status(201).json({
      message: "Package added successfully",
      packageId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding package:", error.message);
    return res
      .status(500)
      .json({ error: "An internal server error occurred." });
  }
}

async function getPackages(req, res) {
    try {
      // Get page and limit from query parameters, with default values
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
  
      // Fetch paginated packages from the database
      const packagesQuery = `
        SELECT package_id, title, description, price, is_public, is_active FROM res_download_packages
        LIMIT ? OFFSET ?`;
  
      const [rows] = await pool.execute(packagesQuery, [limit, offset]);
  
      // Fetch total number of packages for pagination metadata
      const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM res_download_packages`);
  
      // Prepare pagination metadata
      const result = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
        data: rows,
      };
  
      return res.status(200).json({
        message: "Packages fetched successfully",
        status: "success",
        response: result,
      });
    } catch (error) {
      console.error("Error fetching packages:", error.message);
      return res
        .status(500)
        .json({ error: "An internal server error occurred." });
    }
  }
  
async function getPackageById(req, res) {
  try {
    const { packageId } = req.params;

    // Fetch the package from the database
    const [rows] = await pool.execute(
      `SELECT * FROM res_download_packages WHERE package_id = ?`,
      [packageId]
    );

    // Check if the package exists
    if (rows.length === 0) {
      return res.status(404).json({ error: "Package not found." });
    }

    // Convert fields back to their original values
    const pkg = rows[0];

    // Convert period back to original unit
    const period =
      PERIOD_UNITS_IN_SECONDS[pkg.period_unit] > 0
        ? pkg.period / PERIOD_UNITS_IN_SECONDS[pkg.period_unit]
        : 0;

    // Convert bandwidth back to original unit
    const bandwidth =
      BANDWIDTH_UNITS_IN_BYTES[pkg.bandwidth_quota_unit] > 0
        ? pkg.bandwidth / BANDWIDTH_UNITS_IN_BYTES[pkg.bandwidth_quota_unit]
        : 0;

    // Convert fair back to original unit
    const fair =
      BANDWIDTH_UNITS_IN_BYTES[pkg.fair_quota_unit] > 0
        ? pkg.fair / BANDWIDTH_UNITS_IN_BYTES[pkg.fair_quota_unit]
        : 0;

    // Return the package to the client
    return res.status(200).json({
      package_id: pkg.package_id,
      title: pkg.title,
      description: pkg.description,
      price: +pkg.price,
      is_expirable: !!pkg.is_expirable,
      period,
      period_unit: pkg.period_unit,
      limit_devices: !!pkg.limit_devices,
      devices: pkg.devices,
      is_public: !!pkg.is_public,
      is_active: !!pkg.is_active,
      is_bandwidth: !!pkg.is_bandwidth,
      is_bandwidth_limit_size: !!pkg.is_bandwidth_limit_size,
      bandwidth,
      bandwidth_quota_unit: pkg.bandwidth_quota_unit,
      is_bandwidth_files: !!pkg.is_bandwidth_files,
      bandwidth_files: pkg.bandwidth_files,
      bandwidth_feature: pkg.bandwidth_feature,
      is_fair: !!pkg.is_fair,
      is_fair_limit_size: !!pkg.is_fair_limit_size,
      fair,
      fair_quota_unit: pkg.fair_quota_unit,
      is_fair_files: !!pkg.is_fair_files,
      fair_files: pkg.fair_files,
    });
  } catch (error) {
    console.error("Error fetching package:", error.message);
    return res
      .status(500)
      .json({ error: "An internal server error occurred." });
  }
}

async function updatePackage(req, res) {
  try {
    const {
      package_id,
      title,
      description,
      price,
      is_expirable,
      period: inputPeriod,
      period_unit,
      limit_devices,
      devices,
      is_public,
      is_active,
      is_bandwidth = false,
      is_bandwidth_limit_size = false,
      bandwidth: inputBandwidth = 0,
      bandwidth_quota_unit = "Bytes",
      is_bandwidth_files = false,
      bandwidth_files = 0,
      bandwidth_feature = null,
      is_fair = false,
      is_fair_limit_size = false,
      fair = 0,
      fair_quota_unit = "Bytes",
      is_fair_files = false,
      fair_files = 0,
    } = req.body;

    // Validate input using Joi
    const { error } = packageSchema.validate(req.body, { abortEarly: false }); // `abortEarly: false` to get all errors at once
    if (error) {
      // If validation fails, return the validation errors
      const errorMessages = error.details.map((err) => err.message);
      return res.status(400).json({ errors: errorMessages });
    }

    // Convert period to seconds
    const periodInSeconds =
      Number(inputPeriod) * PERIOD_UNITS_IN_SECONDS[period_unit];

    // Convert bandwidth to bytes
    const bandwidthInBytes =
      Number(inputBandwidth) * BANDWIDTH_UNITS_IN_BYTES[bandwidth_quota_unit];

    // Convert fair to bytes
    const fairInBytes =
      Number(fair) * BANDWIDTH_UNITS_IN_BYTES[fair_quota_unit];

    // Update the package in the database
    await pool.execute(
      `UPDATE res_download_packages SET title = ?, description = ?, price = ?, is_expirable = ?, period = ?, period_unit = ?, 
      limit_devices = ?, devices = ?, is_public = ?, is_active = ?, 
      is_bandwidth = ?, is_bandwidth_limit_size = ?, bandwidth = ?, bandwidth_quota_unit = ?, 
      is_bandwidth_files = ?, bandwidth_files = ?, bandwidth_feature = ?, 
      is_fair = ?, is_fair_limit_size = ?, fair = ?, fair_quota_unit = ?, is_fair_files = ?, fair_files = ? 
      WHERE package_id = ?`,
      [
        title,
        description,
        price,
        is_expirable,
        periodInSeconds,
        period_unit,
        limit_devices,
        devices,
        is_public,
        is_active,
        is_bandwidth,
        is_bandwidth_limit_size,
        bandwidthInBytes,
        bandwidth_quota_unit,
        is_bandwidth_files,
        bandwidth_files,
        bandwidth_feature,
        is_fair,
        is_fair_limit_size,
        fairInBytes,
        fair_quota_unit,
        is_fair_files,
        fair_files,
        package_id,
      ]
    );

    return res.status(200).json({ message: "Package updated successfully" });
  } catch (error) {
    console.error("Error updating package:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function deletePackage(req, res) {
    try {
      // Extract packageId from the request parameters
      const { packageId } = req.params;
  
      // Validate that packageId is a valid number
      if (isNaN(packageId) || packageId <= 0) {
        return res.status(400).json({ error: "Invalid package ID" });
      }
  
      // Check if the package exists
      const [existingPackage] = await pool.execute(
        `SELECT * FROM res_download_packages WHERE package_id = ?`,
        [packageId]
      );
  
      if (existingPackage.length === 0) {
        return res.status(404).json({ error: "Package not found" });
      }
  
      // Delete the package from the database
      await pool.execute(
        `DELETE FROM res_download_packages WHERE package_id = ?`,
        [packageId]
      );
  
      return res.status(200).json({ message: "Package deleted successfully" });
    } catch (error) {
      console.error("Error deleting package:", error.message);
      return res.status(500).json({ error: "An internal server error occurred." });
    }
  }
  

module.exports = { addPackage, getPackages, getPackageById, updatePackage, deletePackage };
