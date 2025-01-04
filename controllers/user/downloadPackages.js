const express = require("express");
const { pool } = require("../../config/database");

async function getPackageDetails(req, res) {
  try {
    const id = req.query.id;

    let query;
    let params;

    if (id) {
      // If ID is provided, fetch details for a specific package
      query = "SELECT * FROM res_download_packages WHERE package_id = ?";
      params = [id];
    } else {
      // If no ID is provided, fetch all public packages
      query = "SELECT * FROM res_download_packages WHERE is_public = ?";
      params = ["1"];
    }

    const [rows] = await pool.execute(query, params);

    return res.status(200).json({
      status: "success",
      response: {
        data: rows
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

async function getPackages(req, res) {
  try {
   
    const query = "SELECT * FROM res_download_packages where is_public = 1";
    const [rows] = await pool.execute(query);

    return res.status(200).json({
      status: "success",
      response: {
        data: rows
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}


async function getAllFolders(req, res) {
  try {
    let id = req.query.id;
    if (id === undefined) {
      id = 0;
    }
    console.log(id);

    const [rows] = await pool.execute(
      "SELECT * FROM res_folders WHERE parent_id = ? ORDER BY title ASC",
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}


async function getAllFiles(req, res) {
  try {
    const id = req.query.id;
    console.log(id);

    //const [rows] = await pool.execute('SELECT * FROM res_folders WHERE parent_id = 0 ORDER BY title ASC');
    const [rows] = await pool.execute(
      "SELECT * FROM res_files WHERE folder_id = ? ORDER BY title ASC",
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}


module.exports = { getPackageDetails, getPackages };
