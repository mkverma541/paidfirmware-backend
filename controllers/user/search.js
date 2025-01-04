const { pool } = require("../../config/database");
const { SEARCH_TYPE } = require(".././utils/constants");


async function searchAllTables(req, res) {
  try {
    const { query, type = 0 } = req.query;


    let results = {
      files: [],
      folders: [],
      products: [],
      categories: [],
      blogs: [],
    };

    // Search in all tables if type is 0
    if (type === 0) {
      const [fileRows] = await pool.execute(
        "SELECT slug, title, file_id FROM res_files WHERE title LIKE ?",
        [`%${query}%`]
      );

      const [folderRows] = await pool.execute(
        "SELECT slug, title, folder_id FROM res_folders WHERE title LIKE ?",
        [`%${query}%`]
      );

      const [productRows] = await pool.execute(
        "SELECT slug, product_name, product_id FROM res_products WHERE product_name LIKE ?",
        [`%${query}%`]
      );

      const [categoryRows] = await pool.execute(
        "SELECT slug, category_name, category_id FROM res_product_categories WHERE category_name LIKE ?",
        [`%${query}%`]
      );

      const [blogRows] = await pool.execute(
        "SELECT slug, title, blog_id FROM res_blogs WHERE title LIKE ?",
        [`%${query}%`]
      );

      results.files.push(...fileRows);
      results.folders.push(...folderRows);
      results.products.push(...productRows);
      results.categories.push(...categoryRows);
      results.blogs.push(...blogRows);
    } else if (type === SEARCH_TYPE.FILES) {
      const [rows] = await pool.execute(
        "SELECT slug, title, file_id FROM res_files WHERE title LIKE ?",
        [`%${query}%`]
      );
      results.files.push(...rows);
    } else if (type === SEARCH_TYPE.FOLDERS) {
      const [rows] = await pool.execute(
        "SELECT slug, title, folder_id FROM res_folders WHERE title LIKE ?",
        [`%${query}%`]
      );
      results.folders.push(...rows);
    } else if (type === SEARCH_TYPE.PRODUCTS) {
      const [rows] = await pool.execute(
        "SELECT slug, product_name , product_id FROM res_products WHERE product_name LIKE ?",
        [`%${query}%`]
      );
      results.products.push(...rows);
    } else if (type === SEARCH_TYPE.CATEGORIES) {
      const [rows] = await pool.execute(
        "SELECT slug, category_name, category_id FROM res_product_categories  WHERE category_name LIKE ?",
        [`%${query}%`]
      );
      results.categories.push(...rows);
    } else if (type === SEARCH_TYPE.BLOGS) {
      const [rows] = await pool.execute(
        "SELECT slug, title, blog_id FROM res_blogs WHERE title LIKE ?",
        [`%${query}%`]
      );
      results.blogs.push(...rows);
    }

    // Generate folder paths for folders
    results.folders = await Promise.all(
      results.folders.map(async (folder) => {
        const path = await getFolderPath(folder.folder_id);
        return { ...folder, path };
      })
    );

    res.status(200).json({
      status: "success",
      data: results,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}


async function getFolderPath(folderId) {
  const breadcrumbs = [];
  let currentFolder = null;

  if (folderId) {
    const [rows] = await pool.execute(
      "SELECT folder_id, parent_id, title, slug FROM res_folders WHERE folder_id = ?",
      [folderId]
    );

    if (rows.length > 0) {
      currentFolder = rows[0];

      while (currentFolder) {
        breadcrumbs.unshift({
          title: currentFolder.title,
          slug: currentFolder.slug,
        });

        const [parentRows] = await pool.execute(
          "SELECT folder_id, parent_id, title, slug FROM res_folders WHERE folder_id = ?",
          [currentFolder.parent_id]
        );

        if (parentRows.length === 0) {
          break;
        }

        currentFolder = parentRows[0];
      }
    }
  }

  return breadcrumbs.map((folder) => folder.slug).join("/");
}

module.exports = {
  searchAllTables,
};
