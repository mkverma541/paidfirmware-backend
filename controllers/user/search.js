const express = require("express");
const { pool } = require("../../config/database");


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
      }  else {
        // fetch 3 most recent files or folders
        [files] = await pool.execute(
          `SELECT file_id, folder_id, title FROM res_files ORDER BY date_create DESC LIMIT 3`
        );

        [folders] = await pool.execute(
          `SELECT folder_id, title FROM res_folders ORDER BY date_create DESC LIMIT 3`
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
  
  
  module.exports = {
    searchFilesFolders,
  };