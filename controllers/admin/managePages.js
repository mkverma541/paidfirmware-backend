const { pool } = require("../../config/database");
const fs = require('fs');
const path = require('path');

async function getPages(req, res) {
  try {
    // Extract `page` and `limit` from query parameters, with default values.
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Calculate the `offset` for pagination.
    const offset = (page - 1) * limit;

    // Fetch the paginated results.
    const [rows] = await pool.query(
      "SELECT * FROM res_pages LIMIT ? OFFSET ?",
      [limit, offset]
    );

    // Get the total number of records for pagination metadata.
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM res_pages"
    );

    let response = {
      data: rows,
      status: "success",
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
    // Send the paginated results along with metadata.
    res.status(200).json({
      response: response,
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


async function getPageDetailsById(req, res) {
  try {

    const page_id = req.params.id;

    const [rows] = await pool.query("SELECT * FROM res_pages WHERE page_id = ?", [
      page_id,
    ]);

    res.status(200).json({
      data: rows[0],
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function updatePage(req, res) {
  try {
    const id = req.params.id;

    const { slug, title, description, body, layout, is_active } = req.body;

    await pool.query(
      "UPDATE res_pages SET slug = ?, title = ?, description = ?, body = ?, layout = ?, is_active = ? WHERE page_id = ?",
      [slug, title, description, body, layout, is_active, id]
    );

    res.status(200).json({
      message: "Page updated successfully",
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function createPage(req, res) {
  try {
    const { slug, title, description, layout = 1, body, is_active } = req.body;

    // Check if page with the same slug already exists

    const [rows] = await pool.query("SELECT * FROM res_pages WHERE slug = ?", [
      slug,
    ]);

    if (rows.length > 0) {
      return res.status(400).json({
        message: "Page with the same slug already exists",
        status: "error",
      });
    }

    await pool.query(
      "INSERT INTO res_pages (slug, title, description, body, layout, is_active) VALUES (?, ?, ?, ?, ?, ?)",
      [slug, title, description, body, layout, is_active]
    );


    res.status(200).json({
      message: "Page created successfully",
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function deletePage(req, res) {
  try {
    const id = req.params.id;

    await pool.query("DELETE FROM res_pages WHERE page_id = ?", [id]);

    res.status(200).json({
      message: "Page deleted successfully",
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function generateJsonFile(req, res) {
  const { slug } = req.params;

  try {
    // Fetch the page from the database using the slug
    const [rows] = await pool.query("SELECT * FROM res_pages WHERE slug = ?", [
      slug,
    ]);

    // If no page is found, log an error message
    if (rows.length === 0) {
      console.error(`No page found with the slug: ${slug}`);
      return;
    }

    const page = rows[0];

    // Define the public directory where JSON files will be saved
    const jsonDirectory = path.join(__dirname, "../../public/pages");

    // Ensure the directory exists
    if (!fs.existsSync(jsonDirectory)) {
      fs.mkdirSync(jsonDirectory, { recursive: true });
    }

    // Create the JSON file for the given slug
    const jsonFilePath = path.join(jsonDirectory, `${slug}.json`);

    // Prepare the page data for the JSON file
    const pageData = {
      id: page.id,
      slug: page.slug,
      title: page.title,
      description: page.description,
      body: page.body,
      layout: page.layout,
      is_active: page.is_active,
    };

    // Write the page data to the JSON file
    fs.writeFileSync(jsonFilePath, JSON.stringify(pageData, null, 2));

    res.status(200).json({
      success: true,
      message: `JSON file created: ${jsonFilePath}`,
    });
  } catch (err) {
    console.error("Error generating JSON file:", err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

module.exports = {
  getPages,
  getPageDetailsById,
  updatePage,
  createPage,
  deletePage,
  generateJsonFile,
};
