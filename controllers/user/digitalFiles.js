const express = require("express");
const { pool } = require("../../config/database");

async function getAllFoldersFiles(req, res) {
  try {
    const [folders, files] = await Promise.all([
      pool.execute(
        "SELECT folder_id, parent_id, title, description, thumbnail, is_new, slug " +
          "FROM res_folders WHERE parent_id = 0 ORDER BY created_at DESC"
      ),
      pool.execute(
        "SELECT title, folder_id, file_id, description, thumbnail, is_featured, is_new, price, rating_count, rating_points, size, slug " +
          "FROM res_files WHERE folder_id = 0 ORDER BY created_at DESC"
      ),
    ]);

    const response = {
      folders: folders[0],
      files: files[0],
    };

    res.status(200).json({
      response,
      status: "success",
    });
  } catch (err) {
    console.error("Error fetching folders and files:", err.stack || err);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getFolderDescription(req, res) {
  const slug = req.params.slug;

  try {
    let folder;

    const [rows] = await pool.execute(
      "SELECT title, description, slug FROM res_folders WHERE slug = ?",
      [slug]
    );

    folder = rows[0];

    if (!folder) {
      return res.status(404).json({
        status: "error",
        message: `Folder not found for slug: ${slug}`,
      });
    }

    res.status(200).json({
      status: "success",
      data: folder,
    });
  } catch (error) {
    console.error("Error fetching folder title and description:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getFolderPath(req, res) {
  const { slug } = req.params; // Get the single slug from the URL

  try {
    // Fetch the folder using the slug
    const [rows] = await pool.execute(
      "SELECT folder_id, parent_id, title, slug FROM res_folders WHERE slug = ?",
      [slug]
    );

    // Check if the folder exists
    if (rows.length === 0) {
      console.error(`Folder not found for slug: ${slug}`);
      return res.status(404).json({
        status: "error",
        message: `Folder not found for slug: ${slug}`,
      });
    }

    const breadcrumbs = []; // To store breadcrumb information
    let currentFolder = rows[0];

    // Traverse up the hierarchy for the folder
    while (currentFolder) {
      breadcrumbs.unshift({
        title: currentFolder.title,
        slug: currentFolder.slug,
      }); // Add current folder to breadcrumbs

      // Fetch the parent folder
      const [parentRows] = await pool.execute(
        "SELECT folder_id, parent_id, title, slug FROM res_folders WHERE folder_id = ?",
        [currentFolder.parent_id]
      );

      if (parentRows.length === 0) {
        // No more parents found, exit the loop
        break;
      }

      // Move to the parent folder
      currentFolder = parentRows[0];
    }

    // Send the response with breadcrumb info
    res.status(200).json({
      status: "success",
      path: breadcrumbs,
    });
  } catch (error) {
    console.error("Error fetching folder path:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getFolderAndFiles(req, res) {
  try {
    let slug = req.params.slug;
    let search = req.query.search ? `%${req.query.search}%` : null;

    // Get folder ID by slug
    const [folderIdResults] = await pool.execute(
      "SELECT folder_id FROM res_folders WHERE slug = ?",
      [slug]
    );

    if (folderIdResults.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Folder not found",
      });
    }

    const folderId = folderIdResults[0].folder_id;

    // Build SQL queries
    const folderQuery =
      "SELECT folder_id, slug, parent_id, title, description, thumbnail, is_new " +
      "FROM res_folders WHERE parent_id = ? AND is_active = 1";

    const fileQuery =
      "SELECT title, folder_id, file_id, slug, description, thumbnail, is_featured, is_new, price, rating_count, rating_points, size, created_at " +
      "FROM res_files WHERE folder_id = ? AND is_active = 1";

    // Add search conditions if search is provided
    const folderCondition = search ? " AND title LIKE ?" : "";
    const fileCondition = search ? " AND title LIKE ?" : "";

    // Fetch folders and files concurrently with search conditions
    const [folders] = await pool.execute(
      `${folderQuery}${folderCondition}`,
      search ? [folderId, search] : [folderId]
    );

    const [files] = await pool.execute(
      `${fileQuery}${fileCondition}`,
      search ? [folderId, search] : [folderId]
    );

    // Prepare response
    const response = {
      folders: folders, // Folders within the current directory
      files: files, // Files with all keys from res_files
    };

    res.status(200).json({
      response,
      status: "success",
    });
  } catch (err) {
    console.error("Error fetching folders and files:", err);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getFileByFileSlug(req, res) {
  try {
    const slug = req.params.slug;
    console.log("Fetching file with slug:", slug);

    // Fetch the file from the database
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE slug = ?",
      [slug]
    );

    // Check if the file exists
    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    // Parse tags field to ensure it's an array
    const file = rows[0];
    // file.tags = file.tags ? JSON.parse(file.tags) : []; // Ensure tags is an array => will implement later

    file.tags = file.tags ? file.tags.split("+") : []; // Ensure tags is an array

    res.status(200).json({
      status: "success",
      data: file, // Send the file with parsed tags
    });
  } catch (err) {
    console.error("Error fetching file:", err);
    res.status(500).send("Internal Server Error");
  }
}

async function getFilePath(req, res) {
  const slug = req.params.slug;

  try {
    // Step 1: Find the folder_id associated with the given file slug
    const [fileRows] = await pool.execute(
      "SELECT folder_id FROM res_files WHERE slug = ?",
      [slug]
    );

    // If no folder is found for the given file slug, return a 404
    if (fileRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    // Extract the folder_id from the file's record
    let folderId = fileRows[0].folder_id;

    const path = [];

    // Step 2: Traverse upwards in the folder hierarchy until we reach the root (no parent_id)
    while (folderId) {
      const [rows] = await pool.execute(
        "SELECT folder_id, slug, parent_id, title FROM res_folders WHERE folder_id = ?",
        [folderId]
      );

      // If a folder is found, add it to the path and move to its parent
      if (rows.length > 0) {
        const folder = rows[0];
        path.unshift({
          folder_id: folder.folder_id,
          title: folder.title,
          slug: folder.slug,
        });
        folderId = folder.parent_id; // Update to the parent ID to move up the hierarchy
      } else {
        // If no folder is found for the given folderId, exit the loop
        break;
      }
    }

    // Return the complete folder path as a breadcrumb-like structure
    res.status(200).json({
      status: "success",
      path,
    });
  } catch (error) {
    console.error("Error fetching folder path:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function recentFiles(req, res) {
  try {
    const [rows] = await pool.execute(
      "SELECT title, folder_id, file_id, slug, description, thumbnail, is_featured, is_new, price, rating_count, rating_points, size, created_at FROM res_files WHERE is_active = 1 ORDER BY created_at  DESC LIMIT 20"
    );

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

async function paidFiles(req, res) {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE price > 0 ORDER BY file_id DESC LIMIT 100"
    );

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}


async function freeFiles(req, res) {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE price = 0 and is_featured = 0  ORDER BY file_id DESC LIMIT 100"
    );

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

async function getStats(req, res) {
  const slug = req.params.slug;

  try {
    const [rows] = await pool.execute(
      "SELECT visits, downloads FROM res_files WHERE slug = ?",
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No data found",
      });
    }

    res.status(200).json({
      status: "success",
      data: rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

module.exports = {
  getAllFoldersFiles,
  getFolderDescription,
  getFolderPath,
  getFilePath,
  getFolderAndFiles,
  getFileByFileSlug,
  recentFiles,
  paidFiles,
  getStats,
  freeFiles,
};
