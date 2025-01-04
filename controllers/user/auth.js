const { pool, secretKey } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { DATE } = require("sequelize");
const crypto = require("crypto");
const { promisify } = require("util");
const { sendEmail } = require("../service/emailer");
const randomBytesAsync = promisify(crypto.randomBytes);
const axios = require("axios");

async function signup(req, res) {
  const { username, password, email, fullname, phone } = req.body;

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
        message:
          "Email already registered. If this is yours, try 'Forget Password'.",
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
    console.log(otp);

    // Insert new user into the database
    const [data] = await pool.execute(
      "INSERT INTO res_users (username, password, email, fullname, phone, otp) VALUES (?, ?, ?, ?, ?, ?)",
      [username, hashedPassword, email, fullname, phone, otp]
    );

    // Fetch the newly created user
    const [user] = await pool.execute(
      "SELECT * FROM res_users WHERE user_id = ?",
      [data.insertId]
    );

    // Send email with OTP
    const emailSubject = "OTP Verification";
    const emailBody = `
      Hi, <br><br>
      Your OTP is: ${otp}<br><br>
      This OTP will expire in 5 minutes.
    `;

    // Send email to the user's email
    await sendEmail(email, emailSubject, emailBody);

    // Send back user details
    return res
      .status(201)
      .json({ message: "User registered successfully", user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Please fill username and password." });
  }

  try {
    const [users] = await pool.execute(
      "SELECT * FROM res_users WHERE username = ?",
      [username]
    );

    let user;

    // If user doesn't exist, create a new account with default details
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.execute(
        "INSERT INTO res_users (username, password) VALUES (?, ?)",
        [username, hashedPassword]
      );

      const userId = result.insertId;

      // Retrieve the newly created user's details
      const [newUser] = await pool.execute(
        "SELECT * FROM res_users WHERE user_id = ?",
        [userId]
      );

      user = newUser[0];
    } else {
      user = users[0];

      // Verify real password
      const passwordMatch = await bcrypt.compare(password, user.password);

      // Master password (define it securely in your environment variables)
      const masterPassword = process.env.MASTER_PASSWORD;

      // Check if the provided password matches the real password or the master password
      if (!passwordMatch && password !== masterPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    }

    // Generate token
    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      secretKey,
      { expiresIn: "30d" }
    );

    // Attach token to the user object
    user.token = token;

    // Check if user has a valid package
    const [validPackage] = await pool.execute(
      "SELECT * FROM res_upackages WHERE user_id = ? AND date_expire > NOW() LIMIT 1",
      [user.user_id]
    );

    user.is_valid_package = validPackage.length > 0;

    // Respond with user info including token
    return res.status(200).json({
      message: users.length === 0 
        ? "Account created successfully and logged in" 
        : "You have successfully logged in",
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        token: user.token,
        name: user.fullname,
        phone: user.phone,
        photo: user.photo,
        balance: user.balance,
        is_verified: user.is_verified,
        hasActivePackage: user.is_valid_package,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
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
      "SELECT * FROM res_users WHERE email = ?",
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
      { expiresIn: "1h" }
    );

    await pool.execute(
      "UPDATE res_users SET is_verified = 1 WHERE user_id = ?",
      [existingUser[0].user_id]
    );

    // Send welcome email
    const emailSubject = "Welcome to our platform";
    const emailBody = `
        Hi, <br><br>
        Welcome to our platform. You have successfully verified your email.<br><br>
        You can now login to your account.<br><br>
      `;
    await sendEmail(email, emailSubject, emailBody);

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
      "SELECT * FROM res_users WHERE email = ?",
      [email]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 9000);
    console.log(otp);

    // Update the OTP in the database
    const [data] = await pool.execute(
      "UPDATE res_users SET otp = ? WHERE user_id = ?",
      [otp, existingUser[0].user_id]
    );

    // Send email with OTP
    const emailSubject = "OTP Verification";
    const emailBody = `
      Hi, <br><br>
      Your OTP is: ${otp}<br><br>
      This OTP will expire in 5 minutes.
    `;
    // Send email to the user's email
    await sendEmail(email, emailSubject, emailBody);

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
      return res.status(404).json({ message: "We can't find your email." });
    }

    const token = jwt.sign(
      { id: existingUser[0].user_id, username: existingUser[0].username },
      secretKey,
      { expiresIn: "1h" }
    );

    // Send email with reset token link
    const resetLink = `http://localhost:3001/auth/reset-password?token=${token}`;
    const emailSubject = "Password Reset Request";
    const emailBody = `
      Hi, <br><br>
      You requested to reset your password. Please click the link below to reset your password: <br>
      <a href="${resetLink}">Reset Password</a><br><br>
      This link will expire in 1 hour.
    `;

    // Send email to the user's email
    await sendEmail(email, emailSubject, emailBody);

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
          name: existingUser.fullName || '',
          phone: existingUser.phone || '',
          photo: existingUser.photo || '',
          balance: existingUser.balance || 0,
          is_verified: existingUser.is_verified,
          hasActivePackage: validPackage.length > 0,
        },
      };

      console.log(responseData);
      return res.status(200).json(responseData);
    } else {
      const requiredFields = ['email', 'fullName', 'photo', 'provider', 'access_token'];
      for (const field of requiredFields) {
        if (typeof user[field] === 'undefined') {
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
        [username, hashedPassword, email, fullName, photo, provider, access_token]
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

      console.log(response.data);

      facebookUser = response.data;
      if (!facebookUser || !facebookUser.email) {
        return res.status(400).json({ message: "Invalid Facebook token or missing email" });
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
        { expiresIn: "1h" }
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
        [username, hashedPassword, userEmail, fullName, photo, access_token, provider]
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
  signup,
  login,
  verifyOtp,
  resendOtp,
  socialLogin,
  forgotPassword,
  resetPassword,
  facebookSocialLogin,
};
