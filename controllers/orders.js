const { pool, secretKey } = require("../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

async function register(req, res) {

  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const [existingUser] = await pool.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hashSync(password, 10);

    await pool.execute("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      hashedPassword,
    ]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function login(req, res, next) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required",
    });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE username = ?",
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

    const user = {
      id: rows[0].id,
      username: rows[0].username,
    };

    const token = jwt.sign(user, secretKey, { expiresIn: "1h" });

    const data = {
      status : "success",
      token: token
    }

    res.json(data);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function orders(req, res) {
  try {
    const [data] = await pool.execute("SELECT * FROM res_orders ORDER BY date_create DESC");
    console.log(data);
    return res.status(200).json({
      data: data,
    });
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}




module.exports = { register, login, orders };
