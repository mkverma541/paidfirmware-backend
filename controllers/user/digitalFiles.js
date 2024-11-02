const express = require("express");
const { pool } = require("../../config/database");
const axios = require("axios");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const verifyToken = require("../utils/verifyToken");
const NodeCache = require("node-cache");
const fileCache = new NodeCache({ stdTTL: 0 }); // Cache TTL of 1 hour


// root folder and files

async function getAllFoldersFiles(req, res) {
  try {
    const cacheKey = "allFoldersFiles";
    const cachedResponse = fileCache.get(cacheKey);

    if (cachedResponse) {
      console.log(`Cache hit for key: ${cacheKey}`);
      return res.status(200).json({
        response: cachedResponse,
        status: "success",
        fromCache: true,
      });
    }

    console.log(`Cache miss for key: ${cacheKey}. Fetching from database...`);

    const [folders, files] = await Promise.all([
      pool.execute(
        "SELECT folder_id, parent_id, title, description, thumbnail, is_new, slug " +
          "FROM res_folders WHERE parent_id = 0 ORDER BY date_create DESC"
      ),
      pool.execute(
        "SELECT title, folder_id, file_id, description, thumbnail, is_featured, is_new, price, rating_count, rating_points, size, slug " +
          "FROM res_files WHERE folder_id = 0 ORDER BY date_create DESC"
      ),
    ]);

    const response = {
      folders: folders[0],
      files: files[0],
    };

    console.log(
      `Data fetched from database and stored in cache for key: ${cacheKey}`
    );
    fileCache.set(cacheKey, response);

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
  const cacheKey = `folderDes:${slug}`; // Add prefix to cache key

  try {
    // Check if the result is in the cache
    const cachedResult = fileCache.get(cacheKey);
    let folder;

    if (cachedResult) {
      folder = cachedResult; // Use cached result
    } else {
      // Query the database for folder details
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

      // Cache the result with the unique key
      fileCache.set(cacheKey, folder);
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
  console.log("Requesting folder path for slug:", slug);

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
      breadcrumbs.unshift({ title: currentFolder.title, slug: currentFolder.slug }); // Add current folder to breadcrumbs

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

    // Generate a cache key based on the slug and search term
    const cacheKey = search ? `${slug}:${search}` : slug;

    // Check if the result is in the cache
    const cachedResult = fileCache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        response: cachedResult,
        status: "success",
      });
    }

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
      "SELECT title, folder_id, file_id, slug, description, thumbnail, is_featured, is_new, price, rating_count, rating_points, size, date_create " +
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

    // Cache the result
    fileCache.set(cacheKey, response);

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
    console.log('Slug:', slug);

    // Check if the file data is in the cache
    const cachedFile = fileCache.get(`fileDetails${slug}`);
    if (cachedFile) {
      return res.status(200).json({
        status: "success",
        data: cachedFile,
      });
    }

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
    file.tags = file.tags ? JSON.parse(file.tags) : []; // Ensure tags is an array

    // Store the file in the cache
    fileCache.set(slug, file);

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
  console.log("slug", slug);

  // Check if the result for this slug is already in the cache
  const cachedPath = fileCache.get(`filePath-${slug}`);
  if (cachedPath) {
    return res.status(200).json({
      status: "success",
      path: cachedPath,
    });
  }

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
        path.unshift({ folder_id: folder.folder_id, title: folder.title, slug: folder.slug });
        folderId = folder.parent_id; // Update to the parent ID to move up the hierarchy
      } else {
        // If no folder is found for the given folderId, exit the loop
        break;
      }
    }

    // Store the computed path in the cache before sending the response
    fileCache.set(slug, path);

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


async function generateDownloadLink(req, res) {
  const { id } = req.user;
  const userId = id;
  const packageId = 0; // will change it later

  const { fileId } = req.params;

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [fileId]
    );

    if (rows.length === 0) {
      throw new Error("File not found");
    }

    // Set link expiration time (testing: 60 seconds)
    const expirationTime = Math.floor(Date.now() / 1000) + 60;

    // Token data (only include necessary data like fileId, userId, expirationTime)
    const tokenData = { fileId, userId, expirationTime };

    // Generate token (you should have your own token generation logic)
    const token = generateToken(tokenData); // Ensure this function exists

    // Save the download record in the database
    await pool.execute(
      `INSERT INTO res_udownloads (user_id, upackage_id, file_id, hash_token, date_expire) 
       VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
      [userId, packageId, fileId, token, expirationTime]
    );
    console.log(token, "token");

    // Return the generated download URL with the token
    return res.status(200).json({
      status: "success",
      token: token,
    });
  } catch (err) {
    console.error(err);
    throw new Error("Internal Server Error");
  }
}

// Function to handle the download request

async function downloadFile(req, res) {
  try {
    // Get the token from the query string

    const token = req.query.token;

    // Verify the token
    const tokenData = verifyToken(token);

    const fileId = tokenData.fileId.fileId;
    console.log(fileId);

    const expirationTime = tokenData.fileId.expirationTime;

    // Check if the link is expired
    const currentTime = Math.floor(Date.now() / 1000);

    if (currentTime > tokenData.expirationTime) {
      return res
        .status(403)
        .json({ status: "error", message: "Download link expired" });
    }

    // Fetch the file details from the database
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [fileId] // Now fileId is a number
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    const file = rows[0];

    const fileUrl = file.url;

    return res.status(200).json({
      status: "success",
      link: fileUrl,
    });
  } catch (error) {
    console.error("Download error:", error);
    return res
      .status(400)
      .json({ status: "error", message: "Invalid or expired download link" });
  }
}


async function recentFiles(req, res) {
  // Check if recent files are already cached
  const cachedRecentFiles = fileCache.get('recentFiles');

  if (cachedRecentFiles) {
    return res.status(200).json({
      status: "success",
      data: cachedRecentFiles,
    });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT title, folder_id, file_id, slug, description, thumbnail, is_featured, is_new, price, rating_count, rating_points, size, date_create FROM res_files WHERE is_active = 1 ORDER BY date_create DESC LIMIT 20"
    );

    // Store the result in cache
    fileCache.set('recentFiles', rows);

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


module.exports = {
  getAllFoldersFiles,
  getFolderDescription,
  getFolderPath,
  getFilePath,
  getFolderAndFiles,
  getFileByFileSlug,
  recentFiles,
  generateDownloadLink,
  downloadFile,
  paidFiles,
};
