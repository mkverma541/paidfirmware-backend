const express = require("express");
const Joi = require("joi");
const { pool } = require("../../config/database");


async function create(req, res) {
  // Validate the request body of discount code creation unique

  const { error, value } = discountSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const {
    discount_code,
    amount_type,
    amount,
    start_date,
    start_time,
    is_min_purchase,
    order_min,
    applies_to,
    is_usage_limit,
    usage_limit,
    is_usage_limit_per_customer,
    is_end_date,
    end_date,
    end_time,
  } = value;

  let status = 2; // Default to "scheduled" (2)

  const currentDate = new Date();

  if (
    new Date(start_date) <= currentDate &&
    (!end_date || new Date(end_date) >= currentDate)
  ) {
    status = 1; // If the current date is within the discount date range, it's "active" (1)
  } else if (end_date && new Date(end_date) < currentDate) {
    status = 3; // If the discount has expired, set to "expired" (3)
  }

  try {
    // Check if the discount_code already exists
    const [rows] = await pool.execute(
      "SELECT 1 FROM res_discounts WHERE discount_code = ? LIMIT 1",
      [discount_code]
    );

    if (rows.length > 0) {
      return res.status(400).json({ error: "Discount code already exists" });
    }

    await pool.execute(
      `INSERT INTO res_discounts (
        discount_code, amount_type, amount, start_date, start_time,
        is_min_purchase, order_min, applies_to, is_usage_limit, 
        usage_limit, is_usage_limit_per_customer, is_end_date, 
        end_date, end_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        discount_code,
        amount_type,
        amount,
        start_date,
        start_time,
        is_min_purchase,
        order_min || null,
        applies_to,
        is_usage_limit,
        usage_limit || null,
        is_usage_limit_per_customer,
        is_end_date,
        end_date || null,
        end_time || null,
        status,
      ]
    );

    res.status(201).json({ message: "Discount code created successfully" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get a list of discounts with pagination

async function getList(req, res) {
  try {
    // ✅ Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // ✅ Filtering based on query params
    const statusFilter = req.query.status || "all"; // Default to 'all' if no status query param is provided
    const currentDate = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    // ✅ Dynamic WHERE Clause Construction
    let conditions = [];
    let queryParams = [limit, offset];  // Default pagination parameters

    // Adding filters based on status
    if (statusFilter === "active") {
      conditions.push("d.is_active = 1", "d.start_date <= ?", "d.end_date >= ?");
      queryParams.unshift(currentDate, currentDate); // Add current date for comparison
    } else if (statusFilter === "expired") {
      conditions.push("d.end_date < ?");
      queryParams.unshift(currentDate); // Add current date for comparison
    } else if (statusFilter === "scheduled") {
      conditions.push("d.start_date > ?");
      queryParams.unshift(currentDate); // Add current date for comparison
    }

    // If status is "all", we don't need any status-specific condition, so skip adding filters here

    // ✅ Construct the WHERE clause based on the conditions
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // ✅ SQL query to fetch discounts with pagination and calculated status
    const query = `
      SELECT d.id, d.name, d.code, d.discount_type, d.value, d.value_type,
             d.start_date, d.end_date, d.min_order_amount, d.usage_limit, d.is_active,
             CASE
               WHEN d.is_active = 0 THEN 'inactive'
               WHEN d.end_date < CURDATE() THEN 'expired'
               WHEN d.start_date > CURDATE() THEN 'scheduled'
               ELSE 'active'
             END AS status
      FROM discounts d
      ${whereClause}
      ORDER BY d.start_date DESC
      LIMIT ? OFFSET ?
    `;

    // ✅ Execute paginated query
    const [discounts] = await pool.execute(query, queryParams);

    // ✅ Query to get total count for pagination metadata
    const totalCountQuery = `
      SELECT COUNT(*) AS total
      FROM discounts d
      ${whereClause}
    `;
    const [totalCountResult] = await pool.execute(totalCountQuery, queryParams.slice(0, conditions.length));

    const total = totalCountResult[0]?.total || 0;

    // ✅ Pagination result structure
    const result = {
      data: discounts,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      status: "success",
    };

    // ✅ Return response
    res.status(200).json({ response: result });
  } catch (error) {
    console.error("Error fetching discounts:", error);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function update(req, res) {
  const { error, value } = discountSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const {
    discount_id,
    discount_code,
    amount_type,
    amount,
    start_date,
    start_time,
    is_min_purchase,
    order_min,
    applies_to,
    is_usage_limit,
    usage_limit,
    is_usage_limit_per_customer,
    is_end_date,
    end_date,
    end_time,
  } = value;

  try {
    // Check if the discount_code already exists
    // Check if the discount code to be updated exists
    const [existingDiscount] = await pool.execute(
      "SELECT * FROM res_discounts WHERE discount_id = ? LIMIT 1",
      [discount_id]
    );

    if (existingDiscount.length === 0) {
      return res.status(404).json({ error: "Discount code not found" });
    }

    // Check if the new discount_code already exists (but not for the current record)
    const [duplicate] = await pool.execute(
      "SELECT 1 FROM res_discounts WHERE discount_code = ? AND discount_id != ? LIMIT 1",
      [discount_code, discount_id]
    );

    if (duplicate.length > 0) {
      return res.status(400).json({ error: "Discount code already exists" });
    }

    await pool.execute(
      `UPDATE res_discounts SET
            discount_code = ?,
            amount_type = ?, amount = ?, start_date = ?, start_time = ?,
            is_min_purchase = ?, order_min = ?, applies_to = ?, is_usage_limit = ?, 
            usage_limit = ?, is_usage_limit_per_customer = ?, is_end_date = ?, 
            end_date = ?, end_time = ?
        WHERE discount_id = ?`,
      [
        discount_code,
        amount_type,
        amount,
        start_date,
        start_time,
        is_min_purchase,
        order_min || null,
        applies_to,
        is_usage_limit,
        usage_limit || null,
        is_usage_limit_per_customer,
        is_end_date,
        end_date || null,
        end_time || null,
        discount_id,
      ]
    );

    res.json({ message: "Discount code updated successfully" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function remove(req, res) {
  const { id } = req.params;

  try {
    await pool.execute("DELETE FROM res_discounts WHERE discount_id = ?", [id]);

    res.json({ message: "Discount code removed successfully" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
// Helper function to convert 0/1 values to booleans
const convertToBoolean = (obj, fields) => {
  fields.forEach((field) => {
    if (obj.hasOwnProperty(field)) {
      obj[field] = obj[field] === 1;
    }
  });
};

// Helper function to convert date to yyyy-mm-dd format
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0"); // months are 0-indexed
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper function to ensure time is in 24-hour format (HH:mm)
const formatTime = (time) => {
  const [hour, minute] = time.split(":");
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

async function getDiscount(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM res_discounts WHERE discount_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Discount code not found" });
    }

    // Fields that need to be converted to boolean
    const booleanFields = [
      "is_min_purchase",
      "is_usage_limit",
      "is_usage_limit_per_customer",
      "is_end_date",
    ];

    // Convert 0/1 to boolean for the relevant fields
    const discount = rows[0];
    convertToBoolean(discount, booleanFields);

    // Format start_date and end_date to yyyy-mm-dd
    if (discount.start_date) {
      discount.start_date = formatDate(discount.start_date);
    }

    if (discount.end_date) {
      discount.end_date = formatDate(discount.end_date);
    }

    // Ensure start_time and end_time are in 24-hour format (HH:mm)
    if (discount.start_time) {
      discount.start_time = formatTime(discount.start_time);
    }

    if (discount.end_time) {
      discount.end_time = formatTime(discount.end_time);
    }

    res.json(discount);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { create, getList, update, remove, getDiscount };
