const { pool } = require("../config/database");

async function generateClientCode() {
  const [result] = await pool.query(
    "SELECT MAX(client_code) AS max_code FROM clients WHERE client_code REGEXP '^C[0-9]+$'"
  );

  let newCode = 1000; // Start from 1000 if table is empty

  if (result[0].max_code) {
    // Extract numeric part from the last client_code (e.g., "C1001" → 1001)
    const lastNumber = parseInt(result[0].max_code.substring(1), 10);
    newCode = lastNumber + 1;
  }

  return `C${newCode}`;
}

async function createClient(req, res) {
  try {
    const {
      client_name,
      contact_person,
      country,
      email,
      contact_number,
      website_url,
      status = 1,
    } = req.body;

    if (!client_name || !contact_person || !country || !website_url) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    const client_code = await generateClientCode();

    const query = `
            INSERT INTO clients (client_code, client_name, contact_person, country, email, contact_number, website_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

    await pool.query(query, [
      client_code,
      client_name,
      contact_person,
      country,
      email,
      contact_number,
      website_url,
      status || "active",
    ]);

    res.status(201).json({
      message: "Client has been added successfully",
      status: "success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function getAllClients(req, res) {
  try {
    const [clients] = await pool.query(`
      SELECT client_id, client_name FROM clients
    `);

    res.status(200).json({ data: clients, status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}


async function getClients(req, res) {
  try {
    let { status, client_code, client_name, page = 1, limit = 10 } = req.query;

    // Convert query parameters to integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    let queryParams = [];
    
    // Base query to fetch clients with country details
    let clientQuery = `
      SELECT 
        c.client_id, 
        c.client_code, 
        c.client_name, 
        c.status, 
        c.country AS country_code, 
        co.name AS country_name
      FROM clients c
      LEFT JOIN countries co ON c.country = co.code
      WHERE 1=1
    `;

    // Apply filters for client query
    if (status !== undefined && status !== "") {  // Ensure status is not empty or undefined
      clientQuery += " AND c.status = ?";
      queryParams.push(parseInt(status, 10));
    }

    if (client_code && client_code.trim() !== "") {  // Ensure client_code is not empty
      clientQuery += " AND c.client_code LIKE ?";
      queryParams.push(`%${client_code}%`);
    }

    if (client_name && client_name.trim() !== "") {  // Ensure client_name is not empty
      clientQuery += " AND c.client_name LIKE ?";
      queryParams.push(`%${client_name}%`);
    }

    // Pagination
    clientQuery += " LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    // Execute the query to get filtered clients
    const [clients] = await pool.query(clientQuery, queryParams);

    // Get total count of filtered clients
    let countQuery = `
      SELECT COUNT(*) AS total_count 
      FROM clients c
      LEFT JOIN countries co ON c.country = co.code
      WHERE 1=1
    `;

    // Apply the same filters to the count query
    const countParams = [...queryParams];

    if (status !== undefined && status !== "") {
      countQuery += " AND c.status = ?";
    }

    if (client_code && client_code.trim() !== "") {
      countQuery += " AND c.client_code LIKE ?";
    }

    if (client_name && client_name.trim() !== "") {
      countQuery += " AND c.client_name LIKE ?";
    }

    // Get the count of filtered clients
    const [[{ total_count }]] = await pool.query(countQuery, countParams);

    // Calculate total pages based on the total count
    const totalPages = Math.ceil(total_count / limit);

    res.status(200).json({
      data: clients,
      status: "success",
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: totalPages,
        totalItems: total_count
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}


async function getClientCounts(req, res) {
  try {
    // Query to fetch the counts of total, active, and inactive clients
    const countQuery = `
      SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS inactive_count
      FROM clients
    `;

    // Execute the query
    const [[counts]] = await pool.query(countQuery);

    res.status(200).json({
      status: "success",
      data: {
        total: counts.total_count || 0,
        active: counts.active_count || 0,
        inactive: counts.inactive_count || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}



async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const [client] = await pool.query(
      "SELECT * FROM clients WHERE client_id = ?",
      [id]
    );
    if (client.length === 0) {
      return res
        .status(404)
        .json({ message: "Client not found", status: "error" });
    }
    res.status(200).json({ client: client[0], status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function updateClient(req, res) {
  try {
    const {
      client_id,
      client_name,
      contact_person,
      country,
      email,
      contact_number,
      website_url,
      status,
    } = req.body;

    const query = `
            UPDATE clients SET client_name = ?, contact_person = ?, country = ?, email = ?, contact_number = ?, website_url = ?, status = ?
            WHERE client_id = ?
        `;

    const [result] = await pool.query(query, [
      client_name,
      contact_person,
      country,
      email,
      contact_number,
      website_url,
      status,
      client_id,
    ]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Client not found", status: "error" });
    }
    res
      .status(200)
      .json({ message: "Client updated successfully", status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  getAllClients,
  getClientCounts
};
