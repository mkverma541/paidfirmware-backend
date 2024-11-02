const express = require("express");
const { pool } = require("../../config/database");
const axios = require("axios");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const verifyToken = require("../utils/verifyToken");
const NodeCache = require("node-cache");
const fileCache = new NodeCache({ stdTTL: 0 }); // Cache TTL of 1 hour

async function searchFilesFolders(req, res) {
  try {
    const { query } = req.query;

    let files = [];
    let folders = [];

    // If there is a query, build the search conditions
    if (query) {
      const params = [`%${query}%`];

      // Fetch data for files
      [files] = await pool.execute(
        `SELECT file_id, folder_id, title FROM res_files WHERE title LIKE ?`,
        params
      );

      // Fetch data for folders
      [folders] = await pool.execute(
        `SELECT folder_id, title FROM res_folders WHERE title LIKE ?`,
        params
      );
    } else {
      // If no query is present, get the top 4 files and folders
      [files] = await pool.execute(
        `SELECT file_id, folder_id, title FROM res_files ORDER BY date_create DESC LIMIT 4`
      );
      [folders] = await pool.execute(
        `SELECT folder_id, title FROM res_folders ORDER BY date_create DESC LIMIT 4`
      );
    }

    // Send the results to the client
    res.status(200).json({
      status: "success",
      data: { files, folders },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function searchFilesFoldersWithSorting(req, res) {
  try {
    const {
      query,
      type = "both", // default to "both"
      is_active,
      is_new,
      date_created,
      is_featured,
    } = req.query;

    let files = [];
    let folders = [];

    if (query) {
      // If there is a query, build the search conditions
      let fileConditions = "WHERE title LIKE ?";
      let folderConditions = "WHERE title LIKE ?";
      const params = [`%${query}%`];

      // Apply filters to files query
      if (is_active !== undefined) {
        fileConditions += " AND is_active = ?";
        folderConditions += " AND is_active = ?";
        params.push(is_active);
      }
      if (is_new !== undefined) {
        fileConditions += " AND is_new = ?";
        folderConditions += " AND is_new = ?";
        params.push(is_new);
      }
      if (date_created) {
        fileConditions += " AND date_created = ?";
        folderConditions += " AND date_created = ?";
        params.push(date_created);
      }
      if (is_featured !== undefined) {
        fileConditions += " AND is_featured = ?";
        folderConditions += " AND is_featured = ?";
        params.push(is_featured);
      }

      // Fetch data based on the type
      if (type === "files" || type === "both") {
        [files] = await pool.execute(
          `SELECT *  FROM res_files ${fileConditions}`,
          params
        );
      }
      if (type === "folders" || type === "both") {
        [folders] = await pool.execute(
          `SELECT  * FROM res_folders ${folderConditions}`,
          params
        );
      }
    } 
    
    
     const response = {
      folders: folders, // Folders within the current directory
      files: files, // Files with all keys from res_files
    };

    res.status(200).json({
      response,
      status: "success",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}


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


async function getAllFoldersFiles(req, res) {
  try {
    let id = req.query.folder_id || 0;
    let search = req.query.search ? `%${req.query.search}%` : null;

    // Fetch the current path directory
    const path = await getFolderPath(id);

    // Build SQL queries
    const folderQuery =
      "SELECT folder_id, parent_id, title, description, thumbnail, is_active, is_new, date_create " +
      "FROM res_folders WHERE parent_id = ?";

    const fileQuery =
      "SELECT * FROM res_files WHERE folder_id = ?";

    // Add search conditions if search is provided
    const folderCondition = search ? " AND title LIKE ?" : "";
    const fileCondition = search ? " AND title LIKE ?" : "";

    // Fetch folders and files concurrently with search conditions
    const [folders, files] = await Promise.all([
      pool.execute(
        `${folderQuery}${folderCondition} ORDER BY title ASC`,
        search ? [id, search] : [id]
      ),
      pool.execute(
        `${fileQuery}${fileCondition} ORDER BY title ASC`,
        search ? [id, search] : [id]
      ),
    ]);

    // Prepare response
    const response = {
      folders: folders[0], // Folders within the current directory
      files: files[0], // Files with all keys from res_files
    };

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
    const {
      title,
      parent_id,
      description = '',
      thumbnail = null,
      is_active = 1,
      is_new = 1,
    } = req.body;

    // Check if title is empty
    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Please provide a title for the folder.",
      });
    }

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

    // Insert the new folder into the database
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
    console.error("Error adding folder:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        status: "error",
        message: "A folder with this title already exists.",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}


async function updateFolder(req, res) {
  try {
    const { folderId } = req.params; // Get the folder ID from the request parameters
    const { title, parent_id, description, thumbnail, is_active, is_new } = req.body;

    // Check if folderId is provided
    if (!folderId) {
      return res.status(400).json({
        status: "error",
        message: "Folder ID is required. Please refresh the page and try again.",
      });
    }

    // Check if a folder with the same title and parent_id exists, excluding the current folder
    console.log("Folder ID:", folderId);
    console.log("Title:", title);
    console.log("Parent ID:", parent_id);
    const checkQuery = `
      SELECT folder_id FROM res_folders 
      WHERE title = ? AND parent_id = ? AND folder_id != ?
    `;
    const [rows] = await pool.execute(checkQuery, [title, parent_id, folderId]);

    if (rows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "A folder with the same title already exists under the specified parent.",
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
      price = 0.000, // Ensure price defaults to 0.000 if not provided
      url,
      url_type,
      is_active,
      is_new,
      is_featured,
      tags = [],
    } = req.body;

    // Validation: Ensure that both 'is_featured' and 'price' are not set simultaneously
    if (is_featured && price > 0) {
      return res.status(400).json({
        status: "error",
        message: "You cannot select both 'featured file' and 'paid files'. Please choose only one.",
      });
    }

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
      price, // Ensure price is never null here
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


async function cutAndCopyFolder(req, res) {
  try {
    const { folderId, parentId, action } = req.body;

    // Debugging log
    console.log(req.body);
    console.log(
      "folderId:",
      typeof folderId,
      "parentId:",
      typeof parentId,
      "action:",
      action
    );

    // Check if the folderId, parentId, and action are provided
    if (
      folderId === undefined ||
      parentId === undefined ||
      action === undefined
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid request. Please provide folderId, parentId, and action.",
      });
    }

    // Check if the folder exists
    const [folderResults] = await pool.execute(
      "SELECT * FROM res_folders WHERE folder_id = ?",
      [folderId]
    );
    const folder = folderResults[0];

    if (!folder) {
      return res.status(404).json({
        status: "error",
        message: "Folder not found.",
      });
    }

    // Check if the parent folder exists
    const [parentResults] = await pool.execute(
      "SELECT * FROM res_folders WHERE folder_id = ?",
      [parentId]
    );
    const parentFolder = parentResults[0];

    if (!parentFolder) {
      return res.status(404).json({
        status: "error",
        message: "Parent folder not found.",
      });
    }

    // Check if the folder is already in the parent folder
    let [checkResults] = await pool.execute(
      "SELECT * FROM res_folders WHERE parent_id = ? AND title = ?",
      [parentId, folder.title]
    );
    let folderInParent = checkResults[0];

    // If the folder exists, modify its name
    let newFolderName = folder.title;
    if (folderInParent) {
      // Find a new name by appending a number to the folder name
      let folderNumber = 1;
      const folderNameWithoutExtension = folder.title;

      do {
        newFolderName = `${folderNameWithoutExtension} (${folderNumber++})`;
        [checkResults] = await pool.execute(
          "SELECT * FROM res_folders WHERE parent_id = ? AND title = ?",
          [parentId, newFolderName]
        );
        folderInParent = checkResults[0];
      } while (folderInParent);
    }

    // Perform the cut, copy, or paste action
    if (action === "cut" || action === "paste") {
      // Cut or paste the folder by updating the parent_id
      await pool.execute(
        "UPDATE res_folders SET parent_id = ?, title = ? WHERE folder_id = ?",
        [parentId, newFolderName, folderId]
      );
    } else if (action === "copy") {
      // Copy the folder by inserting a new record with the new parent_id and folder name
      const query = `
        INSERT INTO res_folders
        (parent_id, title, description, thumbnail, is_active, is_new)
        VALUES (?, ?, ?, ?, ?, ?)`;

      await pool.execute(query, [
        parentId,
        newFolderName,
        folder.description,
        folder.thumbnail,
        folder.is_active,
        folder.is_new,
      ]);
    } else {
      return res.status(400).json({
        status: "error",
        message: "Invalid action.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Folder moved/copied successfully.",
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
      .filter((key) => fieldsToUpdate[key] !== undefined)
      .map((key) => `${key} = ?`);

    // If no fields to update, return early
    if (updates.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No valid fields to update.",
      });
    }

    // Build the query and values array
    const query = `UPDATE res_files SET ${updates.join(
      ", "
    )} WHERE file_id = ?`;
    const values = [
      ...Object.values(fieldsToUpdate).filter((value) => value !== undefined),
      fileId,
    ];

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


async function updateSlugsForFolders(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();

    const query = `
      UPDATE res_folders AS rf
      SET rf.slug = (
        SELECT
          CASE 
            WHEN COUNT(*) = 0 THEN LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-'))
            ELSE CONCAT(LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-')), '-', COUNT(*))
          END
        FROM res_folders
        WHERE LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-')) = LOWER(REPLACE(REPLACE(REPLACE(title, '_', '-'), '[', '-'), ']', '-'))
        AND rf.id <> id  -- Ensure you're comparing the correct identifiers
        GROUP BY rf.title
      )
      WHERE rf.slug IS NULL;
    `;

    await connection.execute(query);
    
    return res.status(200).json({
      status: "success",
      message: "Successfully updated slugs for folders with NULL values",
    });
    
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: `Error updating slugs: ${error.message}`,
    });
  } finally {
    if (connection) connection.release();
  }
}


module.exports = {
  getAllFoldersFiles,
  getAllFiles,
  getFileByFileId,
  addFolder,
  deleteFolder,
  updateFolder,
  addFile,
  deleteFile,
  updateFile,
  cutAndCopyFile,
  cutAndCopyFolder,
  generateDownloadLink,
  downloadFile,
  searchFilesFolders,
  searchFilesFoldersWithSorting,
  updateSlugsForFolders,
};
