const express = require("express");
const { pool } = require("../../config/database");
const axios = require("axios");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const verifyToken = require("../utils/verifyToken");
const NodeCache = require('node-cache');
const fileCache = new NodeCache({ stdTTL: 0 }); // Cache TTL of 1 hour

async function generateDownloadLink(req, res) {
  const {id } = req.user;
  const userId = id;
  const packageId = 0; // will change it later

  const {fileId} = req.params;

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
    
    const url = "http://localhost:3000/api/v1/user/file/download";

    // Save the download record in the database
    await pool.execute(
      `INSERT INTO res_udownloads (user_id, upackage_id, file_id, hash_token, date_expire) 
       VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
      [userId, packageId, fileId, token, expirationTime]
    );

    // Return the generated download URL with the token
    return res.status(200).json({
      status: "success",
      download_url: `${url}?token=${token}`,
      token : token
    });

  } catch (err) {
    console.error(err);
    throw new Error("Internal Server Error");
  }
}

// Function to handle the download request

async function downloadFile(req, res) {
  console.log("Download file");
  try {
    // Get the token from the query string

    const token = req.query.token;
    console.log("Token:", token); 

    // Verify the token
    const tokenData = verifyToken(token);
   

    const fileId = tokenData.fileId.fileId;
    console.log("File ID:", fileId);
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
    console.log("File:", file);

    const fileUrl = file.url;

    console.log("File URL:", fileUrl);

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

async function getFolderPath(req, res) {
  let folderId = req.params.folderId;

  try {
    const path = [];

    // Traverse upwards in the folder hierarchy until we reach the root (no parent_id)
    while (folderId) {
      const [rows] = await pool.execute(
        "SELECT folder_id, parent_id, title FROM res_folders WHERE folder_id = ?",
        [folderId]
      );

      // If a folder is found, add it to the path and move to its parent
      if (rows.length > 0) {
        const folder = rows[0];
        path.unshift({ folder_id: folder.folder_id, title: folder.title });
        folderId = folder.parent_id; // Update to the parent ID to move up the hierarchy
      } else {
        // If no folder is found for the given folderId, exit the loop
        break;
      }
    }

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

async function getFolderPathByFile(req, res) {
  const fileId = req.params.fileId;

  try {
    // Step 1: Find the folder_id that contains the given file_id
    const [fileRows] = await pool.execute(
      "SELECT folder_id FROM res_files WHERE file_id = ?",
      [fileId]
    );

    // If no folder is found for the given file_id, return a 404
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
        "SELECT folder_id, parent_id, title FROM res_folders WHERE folder_id = ?",
        [folderId]
      );

      // If a folder is found, add it to the path and move to its parent
      if (rows.length > 0) {
        const folder = rows[0];
        path.unshift({ folder_id: folder.folder_id, title: folder.title });
        folderId = folder.parent_id; // Update to the parent ID to move up the hierarchy
      } else {
        // If no folder is found for the given folderId, exit the loop
        break;
      }
    }

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

async function getFolderDescription(req, res) {
  const folderId = req.params.folderId;
  try {
    const [rows] = await pool.execute(
      "SELECT title, description FROM res_folders WHERE folder_id = ?",
      [folderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Folder not found",
      });
    }

    const folder = rows[0];
    res.status(200).json({
      status: "success",
      data: folder,
    });
  }
  catch (error) {
    console.error("Error fetching folder title and description:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function getAllFolders(req, res) {
  try {
    const id = req.query.folder_id || 0;

    // Fetch folders and files concurrently
    const [folders, files] = await Promise.all([
      pool.execute(
        "SELECT folder_id, parent_id, title, description, thumbnail, is_active, is_new " +
        "FROM res_folders WHERE parent_id = ? ORDER BY title ASC",
        [id]
      ),
      pool.execute(
        "SELECT title, folder_id, folder_title, file_id, description, thumbnail, is_active, is_featured, is_new, price, rating_count, rating_points, size, date_create " +
        "FROM res_files WHERE folder_id = ? ORDER BY title ASC",
        [id]
      ),
    ]);

    // Prepare response
    const response = {
      folders: folders[0], // Folders within the current directory
      files: files[0], // Files with all keys from res_files
    };

    // Store the result in the cache with no expiry (assuming fileCache is a valid cache instance)
    fileCache.set(id, response);

    // Send the response
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
      "SELECT * FROM res_files ORDER BY file_id DESC LIMIT 20"
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
  getFolderPath,
  getFolderPathByFile,
  getFolderDescription
};
