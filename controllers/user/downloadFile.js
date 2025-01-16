const express = require("express");
const { pool, secretKey } = require("../../config/database");
const axios = require("axios");
const crypto = require("crypto");

async function generateDownloadLink(req, res) {
  const { id } = req.user;
  const userId = id;

  const { file_id, order_id = null, package_id = null } = req.body;

  try {
    // Check if the file exists
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [file_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    // Check if already added to the user downloads matching order_id, user_id, and file_id
    const [isAlreadyDownloaded] = await pool.execute(
      `SELECT * FROM res_udownloads WHERE user_id = ? AND file_id = ? AND order_id = ?`,
      [userId, file_id, order_id]
    );

    // If a record exists, return the old token
    if (isAlreadyDownloaded.length > 0) {
      return res.status(200).json({
        status: "success",
        link: `${process.env.APP_BASE_URL}/download?token=${isAlreadyDownloaded[0].hash_token}`,
        isDownloaded: true,
      });
    }

    // Generate a new token and expiration time
    const token = crypto.randomBytes(32).toString("hex");
    const expirationTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours
    const expirationDate = new Date(expirationTime * 1000); // Convert to Date object

    // Insert a new entry for the user download
    await pool.execute(
      `INSERT INTO res_udownloads (user_id, file_id, upackage_id, order_id, hash_token, expired_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, file_id, package_id, order_id, token, expirationDate]
    );

    // Return the newly generated download link
    return res.status(200).json({
      status: "success",
      link: `${process.env.APP_BASE_URL}/download?token=${token}`,
      isDownloaded: false,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}


// Function to handle the download request

async function downloadFile(req, res) {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "No download token provided",
      });
    }

    // check is token is valid

    const [isTokenValid] = await pool.execute(
      "SELECT * FROM res_udownloads WHERE hash_token = ?",
      [token]
    );

    if (isTokenValid.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired download link",
      });
    }

    // check if token is expired

    const tokenDetails = isTokenValid[0];

    const expiredAt = new Date(tokenDetails.expired_at).getTime();

    if (expiredAt < Date.now()) {
      return res.status(400).json({
        status: "error",
        message: "Link has expired",
      });
    }

    const fileId = tokenDetails.file_id;

    // get the file details from the database

    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [fileId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    const file = rows[0];

    const fileUrl = file.url;

    // count +1 to the file download count

    await pool.execute(
      "UPDATE res_files SET downloads = downloads + 1 WHERE file_id = ?",
      [fileId]
    );

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

module.exports = {
  generateDownloadLink,
  downloadFile,
};
