const { pool, secretKey } = require("../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { DATE } = require("sequelize");
const crypto = require("crypto");
const { promisify } = require("util");
const randomBytesAsync = promisify(crypto.randomBytes);


async function getAllUsers(page = 1, pageSize = 20) {
  try {
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.execute(
      `SELECT * FROM res_users LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    let res = {
      data: rows,
      page: page,
      pageSize: pageSize,
    };
  
    return res;
  } catch (err) {
    console.error(err);
    return [];
  }
}

module.exports = {
  getAllUsers
};
