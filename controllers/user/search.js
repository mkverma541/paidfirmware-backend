const { pool } = require("../../config/database");
const { SEARCH_TYPE } = require(".././utils/constants");


async function searchAllTables(req, res) {
  try {
    const { query, type = 0 } = req.query;
    const searchTerm = `%${query}%`;
    const limit = 20; // max 20 results per table

    let results = {
      files: [],
      folders: [],
      products: [],
      categories: [],
      blogs: [],
    };

    const queries = [];

    if (type == 0) {
      queries.push(
        pool.execute(
          `SELECT slug, title, file_id FROM res_files WHERE title LIKE ? LIMIT ?`,
          [searchTerm, limit]
        ),
        pool.execute(
          `SELECT slug, title, folder_id FROM res_folders WHERE title LIKE ? LIMIT ?`,
          [searchTerm, limit]
        ),
        pool.execute(
          `SELECT slug, product_name, product_id FROM res_products WHERE product_name LIKE ? LIMIT ?`,
          [searchTerm, limit]
        ),
        pool.execute(
          `SELECT slug, category_name, category_id FROM res_product_categories WHERE category_name LIKE ? LIMIT ?`,
          [searchTerm, limit]
        ),
        pool.execute(
          `SELECT slug, title, blog_id FROM res_blogs WHERE title LIKE ? LIMIT ?`,
          [searchTerm, limit]
        )
      );

      const [
        [fileRows],
        [folderRows],
        [productRows],
        [categoryRows],
        [blogRows],
      ] = await Promise.all(queries);

      results.files = fileRows;
      results.folders = folderRows;
      results.products = productRows;
      results.categories = categoryRows;
      results.blogs = blogRows;
    } else {
      let queryStr = "";
      let table = "";
      let column = "";
      let idField = "";
      let key = "";

      switch (Number(type)) {
        case SEARCH_TYPE.FILES:
          queryStr = "SELECT slug, title, file_id FROM res_files WHERE title LIKE ? LIMIT ?";
          key = "files";
          break;
        case SEARCH_TYPE.FOLDERS:
          queryStr = "SELECT slug, title, folder_id FROM res_folders WHERE title LIKE ? LIMIT ?";
          key = "folders";
          break;
        case SEARCH_TYPE.PRODUCTS:
          queryStr = "SELECT slug, product_name, product_id FROM res_products WHERE product_name LIKE ? LIMIT ?";
          key = "products";
          break;
        case SEARCH_TYPE.CATEGORIES:
          queryStr = "SELECT slug, category_name, category_id FROM res_product_categories WHERE category_name LIKE ? LIMIT ?";
          key = "categories";
          break;
        case SEARCH_TYPE.BLOGS:
          queryStr = "SELECT slug, title, blog_id FROM res_blogs WHERE title LIKE ? LIMIT ?";
          key = "blogs";
          break;
      }

      if (queryStr) {
        const [rows] = await pool.execute(queryStr, [searchTerm, limit]);
        results[key] = rows;
      }
    }

    // Only fetch folder paths if folders are returned
    if (results.folders.length > 0) {
      results.folders = await Promise.all(
        results.folders.map(async (folder) => {
          const path = await getFolderPath(folder.folder_id);
          return { ...folder, path };
        })
      );
    }

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

async function getSearchResults(req, res) {
  const { type, query, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const searchTerm = `%${query}%`;

  try {
    let queryStr = "";
    let key = "";

    switch (Number(type)) {
      case SEARCH_TYPE.FILES:
        queryStr = "SELECT slug, title, file_id FROM res_files WHERE title LIKE ? LIMIT ? OFFSET ?";
        key = "files";
        break;
      case SEARCH_TYPE.FOLDERS:
        queryStr = "SELECT slug, title, folder_id FROM res_folders WHERE title LIKE ? LIMIT ? OFFSET ?";
        key = "folders";
        break;
      case SEARCH_TYPE.PRODUCTS:
        queryStr = "SELECT slug, product_name, product_id FROM res_products WHERE product_name LIKE ? LIMIT ? OFFSET ?";
        key = "products";
        break;
      case SEARCH_TYPE.CATEGORIES:
        queryStr = "SELECT slug, category_name, category_id FROM res_product_categories WHERE category_name LIKE ? LIMIT ? OFFSET ?";
        key = "categories";
        break;
      case SEARCH_TYPE.BLOGS:
        queryStr = "SELECT slug, title, blog_id FROM res_blogs WHERE title LIKE ? LIMIT ? OFFSET ?";
        key = "blogs";
        break;
      default:
        return res.status(400).json({
          status: "error",
          message: "Invalid search type",
        });
    }

    if (queryStr) {
      const [rows] = await pool.execute(queryStr, [searchTerm, Number(limit), offset]);

      // If searching folders, fetch folder paths
      if (key === "folders" && rows.length > 0) {
        rows = await Promise.all(
          rows.map(async (folder) => {
            const path = await getFolderPath(folder.folder_id);
            return { ...folder, path };
          })
        );
      }

      res.status(200).json({
        status: "success",
        data: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
        },
      });
    } else {
      res.status(400).json({
        status: "error",
        message: "No valid query string found",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}


async function searchAllTablesCounts(req, res) {
  try {
    const { query } = req.query;
    const searchTerm = `%${query}%`;

    const queries = [
      pool.execute(`SELECT COUNT(*) as count FROM res_files WHERE title LIKE ?`, [searchTerm]),
      pool.execute(`SELECT COUNT(*) as count FROM res_folders WHERE title LIKE ?`, [searchTerm]),
      pool.execute(`SELECT COUNT(*) as count FROM res_products WHERE product_name LIKE ?`, [searchTerm]),
      pool.execute(`SELECT COUNT(*) as count FROM res_product_categories WHERE category_name LIKE ?`, [searchTerm]),
      pool.execute(`SELECT COUNT(*) as count FROM res_blogs WHERE title LIKE ?`, [searchTerm]),
    ];

    const [
      [fileCountRows],
      [folderCountRows],
      [productCountRows],
      [categoryCountRows],
      [blogCountRows],
    ] = await Promise.all(queries);

    const counts = {
      files: fileCountRows[0].count,
      folders: folderCountRows[0].count,
      products: productCountRows[0].count,
      categories: categoryCountRows[0].count,
      blogs: blogCountRows[0].count,
    };

    res.status(200).json({
      status: "success",
      data: counts,
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
  searchAllTablesCounts,
  getSearchResults
};
