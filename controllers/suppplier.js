const { pool } = require("../config/database");

async function generateClientCode() {
  const [result] = await pool.query(
    "SELECT COUNT(client_id) AS count FROM clients"
  );
  const count = result[0].count + 1000;
  return `C${count}`;
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

async function getClients(req, res) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let query = "SELECT * FROM clients";
    let countQuery = "SELECT COUNT(*) AS total FROM clients";
    let params = [];

    if (search) {
      query += " WHERE client_name LIKE ? OR client_code LIKE ?";
      countQuery += " WHERE client_name LIKE ? OR client_code LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [clients] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const result = {
      total,
      totalPages,
      currentPage: parseInt(page),
      clients,
    };

    res.status(200).json({
      response: result,
      status: "success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const [client] = await pool.query("SELECT * FROM clients WHERE id = ?", [
      id,
    ]);
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
    const { id } = req.params;
    const {
      client_name,
      contact_person,
      country_id,
      email_id,
      contact_number,
      website_url,
      status,
    } = req.body;

    const query = `
            UPDATE clients SET client_name = ?, contact_person = ?, country_id = ?, email_id = ?, contact_number = ?, website_url = ?, status = ?
            WHERE id = ?
        `;

    const [result] = await pool.query(query, [
      client_name,
      contact_person,
      country_id,
      email_id,
      contact_number,
      website_url,
      status,
      id,
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

module.exports = { createClient, getClients, getClientById, updateClient };
