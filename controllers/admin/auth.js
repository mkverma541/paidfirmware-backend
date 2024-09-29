const { pool, secretKey } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { DATE } = require("sequelize");

const adminAuthController = {
  async createAdmin(req, res) {
    const { username, password, email, fullName, phone } = req.body;

    if (!username || !password || !email) {
      return res
        .status(400)
        .json({ error: "Please fill all required fields." });
    }

    try {
      const [existingUser] = await pool.execute(
        "SELECT * FROM res_admins WHERE username = ?",
        [username]
      );
      console.log(existingUser);

      if (existingUser.length > 0) {
        return res.status(409).json({
          message: "Username already exists, please try another username",
        });
      }

      const [existingEmail] = await pool.execute(
        "SELECT * FROM res_admins WHERE email = ?",
        [email]
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          message:
            "Email already registered, if this yours try forget password. ",
        });
      }

      const hashedPassword = await bcrypt.hashSync(password, 10);

      const [data] = await pool.execute(
        "INSERT INTO res_admins (username, password, email, fullName, phone) VALUES (?, ?, ?, ?, ?)",
        [username, hashedPassword, email, fullName, phone]
      );

      console.log(
        "Parameters:",
        username,
        hashedPassword,
        email,
        fullName,
        phone
      );

      const [user] = await pool.execute(
        "SELECT * FROM res_admins WHERE admin_id = ?",
        [data.insertId]
      );

      return user;
    } catch (error) {
      console.error("User registration error:", error);
      throw error;
    }
  },

  async login(req, res, next) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    try {
      let user;

      const [rows] = await pool.execute(
        "SELECT * FROM res_admins WHERE username = ?",
        [username]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const storedHashedPassword = rows[0].password;
      const passwordMatch = await bcrypt.compare(
        password,
        storedHashedPassword
      );

      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid password" });
      }

      user = {
        id: rows[0].user_id,
        username: rows[0].username,
      };


      // token expiry in 1 months

      const token = jwt.sign(user, secretKey, { expiresIn: "30d" });

      return res.status(200).json({
        status: "success",
        token: token,
        user: user,
        message: "You have successfully logged in.",
      });
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};

module.exports = { adminAuthController };
