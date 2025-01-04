const { response } = require("express");
const { pool } = require("../../../config/database");

// Create a new category
async function createCategory(req, res) {
  try {
    const { name, parent_id } = req.body;

    // Check if the category name already exists
    const [existingCategory] = await pool.query(
      `SELECT * FROM res_blogs_categories WHERE name = ?`,
      [name]
    );

    if (existingCategory.length > 0) {
      return res
        .status(400)
        .json({ message: "Category name already exists", status: "error" });
    }

    const query = `INSERT INTO res_blogs_categories (name, parent_id) VALUES (?, ?)`;
    await pool.query(query, [name, parent_id]);

    res
      .status(201)
      .json({ message: "Category created successfully", status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

// Get all categories
async function getCategories(req, res) {
  try {
    // Fetch all categories
    const [rows] = await pool.query(
      `SELECT category_id, name, parent_id, created_at FROM res_blogs_categories ORDER BY created_at DESC`
    );

    // Create a map for easy lookup of categories by category_id
    const categoryMap = {};
    rows.forEach((category) => {
      categoryMap[category.category_id] = category;
    });

    // Helper function to build breadcrumb path
    async function buildBreadcrumb(category) {
      let breadcrumb = [];

      // Traverse through parent categories until there are no more parents
      while (category) {
        breadcrumb.unshift(category.name); // Add current category name to breadcrumb
        if (category.parent_id === null || category.parent_id === 0) {
          break; // No more parent categories
        }
        category = categoryMap[category.parent_id]; // Move to the parent category
      }

      return breadcrumb.join(" > "); // Join categories with " > "
    }

    // Build the breadcrumb for each category
    const breadcrumbs = [];
    for (let category of rows) {
      const breadcrumb = await buildBreadcrumb(category);
      breadcrumbs.push({
        category: breadcrumb,
        category_id: category.category_id,
        name: category.name,
        created_at: category.created_at,
        parent_id: category.parent_id,
        status: "success",
      });
    }

    const result = {
        data: breadcrumbs,
        status: "success",
    } 

    res.status(200).json({ response: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

// Delete a category
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;

    const query = `DELETE FROM res_blogs_categories WHERE category_id = ?`;
    await pool.query(query, [id]);

    res
      .status(200)
      .json({ message: "Category deleted successfully", status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

// update category
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, parent_id } = req.body;

    // Check if the category name already exists
    const [existingCategory] = await pool.query(
      `SELECT * FROM res_blogs_categories WHERE name = ?`,
      [name]
    );

    if (existingCategory.length > 0) {
      return res
        .status(400)
        .json({ message: "Category name already exists", status: "error" });
    }

    const query = `UPDATE res_blogs_categories SET name = ?, parent_id = ? WHERE category_id = ?`;
    await pool.query(query, [name, parent_id, id]);

    res
      .status(201)
      .json({ message: "Category updated successfully", status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

module.exports = { createCategory, getCategories, deleteCategory, updateCategory };
