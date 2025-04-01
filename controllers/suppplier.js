const { pool } = require("../config/database");

async function generateSupplierCode() {
  const [result] = await pool.query(
    "SELECT COUNT(supplier_id) AS count FROM suppliers"
  );
  const count = result[0].count + 1;
  return `ADR${count.toString().padStart(3, '0')}`;
}

async function addSupplier(req, res) {
  try {
    const {
      supplier_name,
      supplier_website,
      country,
      email,
      contact_number,
      panel_size,
      complete_link,
      terminate_link,
      over_quota_link,
      quality_term_link,
      survey_close_link,
      post_back_url,
      about_supplier,
      allowed_countries,

    } = req.body;

 
    const supplier_code = await generateSupplierCode();
    const allowedCountries = JSON.stringify(allowed_countries);

    const query = `
            INSERT INTO suppliers (supplier_code, supplier_name, supplier_website, country, email, contact_number, panel_size, complete_link, terminate_link, over_quota_link, quality_term_link, survey_close_link, post_back_url, about_supplier, allowed_countries)
            VALUES (?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?)
        `;

    await pool.query(query, [
      supplier_code,
      supplier_name,
      supplier_website,
      country,
      email,
      contact_number,
      panel_size,
      complete_link,
      terminate_link,
      over_quota_link,
      quality_term_link,
      survey_close_link,
      post_back_url,
      about_supplier,
      allowedCountries,
    ]);

    res.status(201).json({
      message: "Supplier has been added successfully",
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

async function getSuppliers(req, res) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let query = "SELECT * FROM suppliers";
    let countQuery = "SELECT COUNT(*) AS total FROM suppliers";
    let params = [];

    if (search) {
      query += " WHERE supplier_name LIKE ? OR supplier_code LIKE ?";
      countQuery += " WHERE supplier_name LIKE ? OR supplier_code LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [suppliers] = await pool.query(query, params);
   
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const result = {
      total,
      totalPages,
      currentPage: parseInt(page),
      suppliers,
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

async function getAllSuppliers(req, res) {
  try {
    const [suppliers] = await pool.query("SELECT * FROM suppliers");
    res.status(200).json({ data: suppliers, status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}  

async function getSupplierById(req, res) {
  try {
    const { id } = req.params;
    const [supplier] = await pool.query("SELECT * FROM suppliers WHERE supplier_id = ?", [
      id,
    ]);


    const allowedCountries = JSON.parse(supplier[0].allowed_countries);
    supplier[0].allowed_countries = allowedCountries;

    if (supplier.length === 0) {
      return res
        .status(404)
        .json({ message: "Supplier not found", status: "error" });
    }
    res.status(200).json({ data:supplier[0], status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function updateSupplier(req, res) {
  try {
    const {
      supplier_id,
      supplier_name,
      supplier_website,
      country,
      email,
      contact_number,
      panel_size,
      complete,
      terminate,
      over_quota,
      quality_term,
      survey_close,
      post_back_url,
      about_supplier,
      allowed_countries,
    } = req.body;

    const allowedCountries = JSON.stringify(allowed_countries);

    const query = `
            UPDATE suppliers SET supplier_name = ?, supplier_website = ?, country = ?, email = ?, contact_number = ?, panel_size = ?, complete = ?, terminate = ?, over_quota = ?, quality_term = ?, survey_close = ?, post_back_url = ?, about_supplier = ?, allowed_countries = ?
            WHERE supplier_id = ?
        `;

    const [result] = await pool.query(query, [
      supplier_name,
      supplier_website,
      country,
      email,
      contact_number,
      panel_size,
      complete,
      terminate,
      over_quota,
      quality_term,
      survey_close,
      post_back_url,
      about_supplier,
      allowedCountries,
      supplier_id,
    ]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Supplier not found", status: "error" });
    }
    res
      .status(200)
      .json({ message: "Supplier updated successfully", status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

module.exports = { addSupplier, getSuppliers, getSupplierById, updateSupplier, getAllSuppliers };