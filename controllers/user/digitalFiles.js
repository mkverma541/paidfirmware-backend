const express = require("express");
const { pool } = require("../../config/database");
const axios = require("axios");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const verifyToken = require("../utils/verifyToken");
const NodeCache = require('node-cache');
const fileCache = new NodeCache({ stdTTL: 0 }); // Cache TTL of 1 hour

async function generateDownloadLink(fileId, userId, packageId) {
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
    const url = "http://localhost:3000/api/v1/file/download";

    // Save the download record in the database
    await pool.execute(
      `INSERT INTO res_udownloads (user_id, upackage_id, file_id, hash_token, date_expire) 
       VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
      [userId, packageId, fileId, token, expirationTime]
    );

    // Return the generated download URL with the token
    return `${url}?token=${token}`;
  } catch (err) {
    console.error(err);
    throw new Error("Internal Server Error");
  }
}

// Function to handle the download request

async function downloadFile(req, res) {

  try {
    // Verify the token
    const tokenData = verifyToken(token);

    const fileId = tokenData.fileId.fileId;
    const expirationTime = tokenData.fileId.expirationTime;

    console.log("Token data:", tokenData);
    console.log("File ID:", fileId);
    console.log("Expiration Time:", expirationTime);

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
    console.log("File:", file);

    const fileUrl = file.url;

    console.log("File URL:", fileUrl);

    // Redirect to the actual file URL
    return res.redirect(fileUrl);
  } catch (error) {
    console.error("Download error:", error);
    return res
      .status(400)
      .json({ status: "error", message: "Invalid or expired download link" });
  }
}

async function getFolderPath(folderId) {
  let path = [];

  while (folderId) {
    const [rows] = await pool.execute(
      "SELECT folder_id, parent_id, title FROM res_folders WHERE folder_id = ?",
      [folderId]
    );

    if (rows.length > 0) {
      const folder = rows[0];
      path.unshift({ folder_id: folder.folder_id, title: folder.title });
      folderId = folder.parent_id;
    } else {
      break;
    }
  }

  return path;
}

// Utility function to remove specified keys from an object
function omitKeys(obj, keys) {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}


async function getAllFolders(req, res) {
  try {
    let id = req.query.folder_id || 0;

    // Check cache for folder data
    const cachedData = fileCache.get(id);
    if (cachedData) {
      console.log('Serving from cache');
      return res.status(200).json({
        response: cachedData,
        status: "success",
      });
    }

    // Fetch the current path directory
    const path = await getFolderPath(id);

    // Fetch folders and files concurrently with all columns of res_files using SELECT *
    const [folders, files] = await Promise.all([
      pool.execute(
        "SELECT folder_id, parent_id, title, description, thumbnail, is_active, is_new " +
        "FROM res_folders WHERE parent_id = ? ORDER BY title ASC",
        [id]
      ),
      pool.execute(
        "SELECT * FROM res_files WHERE folder_id = ? ORDER BY title ASC",
        [id]
      )
    ]);

    // Prepare response
    const response = {
      path, // Path to the current folder
      folders: folders[0], // Folders within the current directory
      files: files[0], // Files with all keys from res_files
    };

    // Store the result in the cache with no expiry
    fileCache.set(id, response);

    res.status(200).json({
      response,
      status: "success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
}

async function getAllFiles(req, res) {
  try {
    const id = req.query.folder_id;
    console.log(id);

    // Fetch files from the database
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE folder_id = ? ORDER BY title ASC",
      [id]
    );

    // Parse tags field to ensure it's an array
    const filesWithParsedTags = rows.map((file) => {
      return {
        ...file,
        tags: file.tags ? JSON.parse(file.tags) : [], // Ensure tags is an array
      };
    });

    res.status(200).json({
      status: "success",
      data: filesWithParsedTags, // Send files with parsed tags
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

async function recentFiles(req, res) {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM res_files ORDER BY file_id DESC LIMIT 100"
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

async function getFileByFileId(req, res) {
  try {
    const id = req.params.fileId;
    console.log(id);

    // Fetch the file from the database
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [id]
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

    res.status(200).json({
      status: "success",
      data: file, // Send the file with parsed tags
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

async function getList(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM res_files");

    return res.status(200).json({
      data: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}
module.exports = {
  getAllFolders,
  getAllFiles,
  getList,
  getFileByFileId,
  recentFiles,
  generateDownloadLink,
  downloadFile,
  paidFiles,
};
