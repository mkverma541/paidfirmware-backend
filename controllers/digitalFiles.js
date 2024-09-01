const express = require("express");
const { pool } = require("../config/database");
const axios = require("axios");

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

async function getAllFolders(req, res) {
  try {
    let id = req.query.folder_id || 0;

    // Fetch the current path directory
    const path = await getFolderPath(id);

    // Fetch folders and files concurrently
    const [folders, files] = await Promise.all([
      pool.execute(
        "SELECT folder_id, parent_id, title, description, thumbnail, is_active, is_new, date_new, date_create, c_user_id, c_username " +
          "FROM res_folders WHERE parent_id = ? ORDER BY title ASC",
        [id]
      ),
      pool.execute(
        "SELECT file_id, folder_id, title, description, body, thumbnail, image, size, price, url, url_type, server_id, visits, downloads, " +
          "is_active, is_new, is_featured, rating_count, rating_points, tags, date_new, date_update, date_create, c_user_id, c_username, u_user_id, u_username " +
          "FROM res_files WHERE folder_id = ? ORDER BY title ASC",
        [id]
      ),
    ]);

    // Prepare response
    let response = {
      path, // Path to the current folder
      folders: folders[0], // Folders within the current directory
      files: files[0], // Files within the current directory
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
      parent_title,
      description,
      thumbnail,
      is_active,
      is_new,
    } = req.body;

    await pool.execute(
      "INSERT INTO res_folders (title, parent_id, parent_title, description, thumbnail, is_active, is_new) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        parent_id,
        parent_title,
        description,
        thumbnail,
        is_active,
        is_new,
      ]
    );
    console.log("Folder added successfully");

    res.status(200).json({
      status: "success",
      message: "Folder added successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
}

async function updateFolder(req, res) {
  try {
    const { folderId } = req.params; // Get the folder ID from the request parameters
    const {
      title,
      parent_id,
      parent_title,
      description,
      thumbnail,
      is_active,
      is_new,
    } = req.body;

    // Execute the SQL query to update the folder data in the database
    const query = `
      UPDATE res_folders 
      SET 
        title = ?,
        parent_id = ?,
        parent_title = ?,
        description = ?,
        thumbnail = ?,
        is_active = ?,
        is_new = ?
      WHERE folder_id = ?
    `;

    const [result] = await pool.execute(query, [
      title,
      parent_id,
      parent_title,
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
    // Step 1: Check if the folder contains any files
    const [files] = await pool.execute(
      "SELECT file_id FROM res_files WHERE folder_id = ?",
      [folderId]
    );

    if (files.length > 0) {
      // If files are present, do not delete the folder
      return res.status(400).json({
        status: "error",
        message: "Folder cannot be deleted because it contains files.",
      });
    }

    // Step 2: Check if the folder contains any subfolders
    const [subfolders] = await pool.execute(
      "SELECT folder_id FROM res_folders WHERE parent_id = ?",
      [folderId]
    );

    if (subfolders.length > 0) {
      // If subfolders are present, do not delete the folder
      return res.status(400).json({
        status: "error",
        message: "Folder cannot be deleted because it contains subfolders.",
      });
    }

    // Step 3: Delete the folder if it's empty (no files and no subfolders)
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
      folder_title,
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
      tags,
    } = req.body;

    // Execute the SQL query to insert the file data into the database
    const query = `
      INSERT INTO res_files 
      (folder_id, folder_title, title, description, body, thumbnail, image, size, price, url, url_type, is_active, is_new, is_featured, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(query, [
      folder_id,
      folder_title,
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
      tags,
    ]);

    console.log("File added successfully");

    // Send a success response to the client
    res.status(200).json({
      status: "success",
      message: "File added successfully",
    });
  } catch (err) {
    // Handle any errors that occur during the execution of the SQL query
    console.error(err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
}

async function updateFile(req, res) {
  try {
    const { fileId } = req.params; // Get the file ID from the request parameters
    const {
      title,
      folder_id,
      folder_title,
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
      tags,
    } = req.body;

    // Execute the SQL query to update the file data in the database
    const query = `
      UPDATE res_files 
      SET 
        folder_id = ?,
        folder_title = ?,
        title = ?,
        description = ?,
        body = ?,
        thumbnail = ?,
        image = ?,
        size = ?,
        price = ?,
        url = ?,
        url_type = ?,
        is_active = ?,
        is_new = ?,
        is_featured = ?,
        tags = ?
      WHERE file_id = ?
    `;

    const [result] = await pool.execute(query, [
      folder_id,
      folder_title,
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
      tags,
      fileId, // File ID is used in the WHERE clause
    ]);

    if (result.affectedRows === 0) {
      // If no rows were affected, the file was not found
      return res.status(404).json({
        status: "error",
        message: "File not found or could not be updated.",
      });
    }

    console.log("File updated successfully");

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
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE folder_id = ? ORDER BY title ASC",
      [id]
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

async function getFileByFileId(req, res) {
  try {
    const id = req.params.fileId;
    console.log(id);
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [id]
    );
    res.status(200).json({
      status: "success",
      data: rows[0],
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
};
