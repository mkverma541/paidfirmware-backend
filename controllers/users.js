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


async function getAllOrders(page = 1, pageSize = 20) {
  try {
    console.log("getAllOrders");
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.execute(
      `SELECT * FROM res_orders LIMIT ? OFFSET ?`,
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


async function socialLogin(req, res) {
  try {
    const user = req.body;

    const [rows] = await pool.execute(
      "SELECT * FROM res_users WHERE email = ?",
      [user.email]
    );

    if (rows.length > 0) {
      const existingUser = {
        id: rows[0].user_id,
        username: rows[0].username,
      };

      const token = jwt.sign(existingUser, secretKey, { expiresIn: "1h" });

      return res.status(200).json({
        message: "You have successfully logged in",
        token: token,
      });
    } else {
      // Generate a random password
      const randomPassword = (await randomBytesAsync(8)).toString("hex");
      console.log(randomPassword);

      const username = user.email;
      const email = user.email;
      const fullName = user.name;
      const photo = user.imageUrl;

      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const [data] = await pool.execute(
        "INSERT INTO res_users (username, password, email, fullName, photo) VALUES (?, ?, ?, ?, ?)",
        [username, hashedPassword, email, fullName, photo]
      );

      const insertedUserID = data.insertId;

      const response = {
        id: insertedUserID,
        username: username,
      };

      const token = jwt.sign(response, secretKey, { expiresIn: "1h" });

      // You might want to avoid returning the password in the response
      return res.status(200).json({
        token: token,
        message: "You have successfully logged in.",
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}


module.exports = {
  getAllUsers,
  socialLogin,
  getAllOrders
};
