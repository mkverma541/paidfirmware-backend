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
  const token = req.query.token;

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

async function addFolder(req, res) {
  try {
    const { title, parent_id, description, thumbnail, is_active, is_new } =
      req.body;

    // Check if a folder with the same title and parent_id already exists
    const checkQuery = `
      SELECT folder_id FROM res_folders WHERE title = ? AND parent_id = ?
    `;
    const [rows] = await pool.execute(checkQuery, [title, parent_id]);

    if (rows.length > 0) {
      return res.status(400).json({
        status: "error",
        message:
          "A folder with the same title already exists under this parent folder.",
      });
    }

    // Execute the SQL query to insert the folder data into the database
    const insertQuery = `
      INSERT INTO res_folders (title, parent_id, description, thumbnail, is_active, is_new)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(insertQuery, [
      title,
      parent_id,
      description,
      thumbnail,
      is_active,
      is_new,
    ]);

    console.log("Folder added successfully");

    res.status(200).json({
      status: "success",
      message: "Folder added successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function updateFolder(req, res) {
  try {
    const { folderId } = req.params; // Get the folder ID from the request parameters
    const { title, parent_id, description, thumbnail, is_active, is_new } =
      req.body;

    // check is folder exist

    if (!folderId) {
      return res.status(400).json({
        status: "error",
        message:
          "Folder ID is required. Please refresh the page and try again.",
      });
    }

    // Check if a folder with the same title exists, but exclude the current folder being updated
    const checkQuery = `
    SELECT folder_id FROM res_folders 
     WHERE title = ? AND folder_id != ?
    `;
    const [rows] = await pool.execute(checkQuery, [title, folderId]);

    if (rows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Folder already exists",
      });
    }

    // Execute the SQL query to update the folder data in the database
    const query = `
      UPDATE res_folders 
      SET 
        title = ?,
        parent_id = ?,
        description = ?,
        thumbnail = ?,
        is_active = ?,
        is_new = ?
      WHERE folder_id = ?
    `;

    const [result] = await pool.execute(query, [
      title,
      parent_id,
      description,
      thumbnail,
      is_active,
      is_new,
      folderId, // Folder ID is used in the WHERE clause
    ]);

    if (result.affectedRows === 0) {
      // If no rows were affected, the folder was not found
      return res.status(404).json({
        status: "error",
        message: "Folder not found or could not be updated.",
      });
    }

    console.log("Folder updated successfully");

    // Send a success response to the client
    res.status(200).json({
      status: "success",
      message: "Folder updated successfully",
    });
  } catch (err) {
    // Handle any errors that occur during the execution of the SQL query
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function deleteFolder(req, res) {
  const folderId = req.params.folderId;

  try {
    // check if folder id exist

    if (!folderId) {
      return res.status(400).json({
        status: "error",
        message: "Folder id is missing. Please refresh page and try again ",
      });
    }
    const [result] = await pool.execute(
      "DELETE FROM res_folders WHERE folder_id = ?",
      [folderId]
    );

    if (result.affectedRows === 0) {
      // Folder not found or could not be deleted
      return res.status(404).json({
        status: "error",
        message: "Folder not found or could not be deleted.",
      });
    }

    // Folder deleted successfully
    return res.status(200).json({
      status: "success",
      message: "Folder deleted successfully.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function addFile(req, res) {
  try {
    const {
      title,
      folder_id,
      description,
      body = null,
      thumbnail = null,
      image = null,
      size,
      price,
      url,
      url_type,
      is_active,
      is_new,
      is_featured,
      tags = [],
    } = req.body;

    // Serialize tags to JSON string
    const jsonTags = JSON.stringify(tags);

    // Check if file name exists in the folder
    const checkQuery = `
      SELECT file_id FROM res_files
      WHERE title = ? AND folder_id = ?
    `;

    const [rows] = await pool.execute(checkQuery, [title, folder_id]);

    if (rows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "A file with the same title already exists in this folder.",
      });
    }

    // Insert the file data into the database
    const query = `
      INSERT INTO res_files 
      (folder_id, title, description, body, thumbnail, image, size, price, url, url_type, is_active, is_new, is_featured, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ensure parameters are properly set to null if they are undefined
    await pool.execute(query, [
      folder_id,
      title,
      description || null,
      body || null,
      thumbnail || null,
      image || null,
      size,
      price,
      url || null,
      url_type || null,
      is_active || 0,
      is_new || 0,
      is_featured || 0,
      jsonTags,
    ]);

    console.log("File added successfully");

    // Send a success response to the client
    res.status(200).json({
      status: "success",
      message: "File added successfully",
    });
  } catch (err) {
    // Handle errors during SQL query execution
    console.error(err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
}

async function cutAndCopyFile(req, res) {
  try {
    const { fileId, folderId, action } = req.body;

    // Debugging log
    console.log(req.body);
    console.log(
      "fileId:",
      typeof fileId,
      "folderId:",
      typeof folderId,
      "action:",
      action
    );

    // Check if the fileId, folderId, and action are provided
    if (
      fileId === undefined ||
      folderId === undefined ||
      action === undefined
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid request. Please provide fileId, folderId, and action.",
      });
    }

    // Check if the file exists
    const [fileResults] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [fileId]
    );
    const file = fileResults[0];

    if (!file) {
      return res.status(404).json({
        status: "error",
        message: "File not found.",
      });
    }

    // Check if the folder exists
    const [folderResults] = await pool.execute(
      "SELECT * FROM res_folders WHERE folder_id = ?",
      [folderId]
    );
    const folder = folderResults[0];

    // if (!folder) {
    //   return res.status(404).json({
    //     status: "error",
    //     message: "Folder not found.",
    //   });
    // }

    // Check if the file is already in the folder
    let [checkResults] = await pool.execute(
      "SELECT * FROM res_files WHERE folder_id = ? AND title = ?",
      [folderId, file.title]
    );
    let fileInFolder = checkResults[0];

    // If the file exists, modify its name
    let newFileName = file.title;
    if (fileInFolder) {
      // Find a new name by appending a number to the file name
      let fileNumber = 1;
      const fileNameWithoutExtension = file.title.replace(/\.[^/.]+$/, "");
      const fileExtension = file.title.split(".").pop();

      do {
        newFileName = `${fileNameWithoutExtension} (${fileNumber++}).${fileExtension}`;
        [checkResults] = await pool.execute(
          "SELECT * FROM res_files WHERE folder_id = ? AND title = ?",
          [folderId, newFileName]
        );
        fileInFolder = checkResults[0];
      } while (fileInFolder);
    }

    // Perform the cut, copy, or paste action
    if (action === "cut" || action === "paste") {
      // Cut or paste the file by updating the folder_id
      await pool.execute(
        "UPDATE res_files SET folder_id = ?, title = ? WHERE file_id = ?",
        [folderId, newFileName, fileId]
      );
    } else if (action === "copy") {
      // Copy the file by inserting a new record with the new folder_id and file name
      const query = `
        INSERT INTO res_files
        (folder_id, title, description, body, thumbnail, image, size, price, url, url_type, is_active, is_new, is_featured, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await pool.execute(query, [
        folderId,
        newFileName,
        file.description,
        file.body,
        file.thumbnail,
        file.image,
        file.size,
        file.price,
        file.url,
        file.url_type,
        file.is_active,
        file.is_new,
        file.is_featured,
        file.tags,
      ]);
    } else {
      return res.status(400).json({
        status: "error",
        message: "Invalid action.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "File moved/copied successfully.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function updateFile(req, res) {
  try {
    const { fileId } = req.params; // Get the file ID from the request parameters
    const {
      title,
      folder_id,
      description,
      body,
      thumbnail,
      image,
      size,
      price,
      url,
      url_type,
      is_active,
      is_new,
      is_featured,
      tags, // This should be an array
    } = req.body;

    // Initialize the fields for update
    const fieldsToUpdate = {
      folder_id,
      title,
      description,
      body,
      thumbnail,
      image,
      size,
      price,
      url,
      url_type,
      is_active,
      is_new,
      is_featured,
      tags: tags !== undefined ? JSON.stringify(tags) : undefined, // Convert tags to JSON string if defined
    };

    // Filter out undefined values and build the update query
    const updates = Object.keys(fieldsToUpdate)
      .filter(key => fieldsToUpdate[key] !== undefined)
      .map(key => `${key} = ?`);

    // If no fields to update, return early
    if (updates.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No valid fields to update.",
      });
    }

    // Build the query and values array
    const query = `UPDATE res_files SET ${updates.join(", ")} WHERE file_id = ?`;
    const values = [...Object.values(fieldsToUpdate).filter(value => value !== undefined), fileId];

    // Execute the SQL query
    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      // If no rows were affected, the file was not found
      return res.status(404).json({
        status: "error",
        message: "File not found or could not be updated.",
      });
    }

    // Send a success response to the client
    res.status(200).json({
      status: "success",
      message: "File updated successfully",
    });
  } catch (err) {
    // Handle any errors that occur during the execution of the SQL query
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}



async function deleteFile(req, res) {
  try {
    const id = req.params.fileId;
    const [rows] = await pool.execute(
      "DELETE FROM res_files WHERE file_id = ?",
      [id]
    );

    res.status(200).json({
      status: "success",
      message: "File deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
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
  addFolder,
  deleteFolder,
  updateFolder,
  addFile,
  deleteFile,
  updateFile,
  cutAndCopyFile,
  generateDownloadLink,
  downloadFile,
  paidFiles,
};
