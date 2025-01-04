const { pool } = require("../../config/database");

// Get subcategories of a single category
async function getSubcategories(req, res) {
  const { categoryId } = req.params; // Extract categoryId from request params

  if (!categoryId) {
    return res
      .status(400)
      .json({ error: "Category ID is required in the URL." });
  }

  try {
    // Query to fetch subcategories of the given category ID
    const [subcategories] = await pool.execute(
      `
      SELECT * 
      FROM res_product_categories 
      WHERE parent_category_id = ?
    `,
      [categoryId]
    );

    res.status(200).json({
      data: subcategories,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function listCategories(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Build the SQL query dynamically
    const searchQuery = search
      ? `WHERE category_name LIKE ? OR slug LIKE ?`
      : "";
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];

    // Fetch categories with pagination and optional search
    const [categories] = await pool.execute(
      `SELECT * FROM res_product_categories ${searchQuery} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...searchParams, limit, offset]
    );

    // Fetch total count of categories for pagination metadata
    const [totalResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM res_product_categories ${searchQuery}`,
      searchParams
    );

    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      message: "Categories retrieved successfully",
      response: {
        data: categories,
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  listCategories,
  getSubcategories,
};
