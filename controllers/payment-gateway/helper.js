const { pool } = require("../../config/database");
const jwt = require("jsonwebtoken");

const { sendEmail } = require("../service/emailer");

// Fetch user by ID
const getUserById = async (userId) => {
  const [user] = await pool.execute(
    "SELECT * FROM res_users WHERE user_id = ?",
    [userId]
  );
  return user;
};

// Check if payment already exists in the database
const checkExistingPayment = async (paymentId) => {
  const [existingPayment] = await pool.execute(
    "SELECT * FROM res_orders WHERE payment_id = ?",
    [paymentId]
  );
  return existingPayment;
};

// Fetch Razorpay order details
const fetchOrderDetails = async (razorpay, orderId) => {
  return await razorpay.orders.fetch(orderId);
};

// Fetch and validate user cart
const fetchUserCart = async (userId) => {
  const [userCart] = await pool.execute(
    "SELECT *  FROM res_cart WHERE user_id = ?",
    [userId]
  );
  return userCart;
};

// fetch total amount of cart items

const fetchTotalAmount = async (userId) => {
  const query = `
    SELECT 
      SUM(
        (CASE WHEN f.file_id IS NOT NULL THEN f.price * c.quantity ELSE 0 END) +
        (CASE WHEN p.package_id IS NOT NULL THEN p.price * c.quantity ELSE 0 END)
      ) AS total_amount
    FROM res_cart c
    LEFT JOIN res_files f ON c.file_id = f.file_id
    LEFT JOIN res_download_packages p ON c.package_id = p.package_id
    WHERE c.user_id = ?;
  `;

  const [rows] = await pool.execute(query, [userId]);

  // Access the total_amount field from the first row and return it
  const totalAmount = rows[0]?.total_amount || 0;

  return totalAmount; // Return only the number
};

const insertOrder = async (d) => {
  const [order] = await pool.execute(
    `INSERT INTO res_orders (user_id, transaction_order_id, amount_due, amount_paid, payment_method, currency, notes, item_types) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.user_id,
      d.transaction_order_id,
      +d.amount_due,
      +d.amount_paid,
      d.payment_method,
      d.currency,
      d.notes,
      d.item_types,
    ]
  );
  console.log(order);
  return order.insertId;
};

const getOrderIdByTransactionOrderId = async (transactionOrderId) => {
  const [order] = await pool.execute(
    "SELECT order_id FROM res_orders WHERE transaction_order_id = ?",
    [transactionOrderId]
  );
  console.log(order);
  return order[0].order_id;
};

const updatePaymentStatus = async (data) => {
  console.log(data, "data payment");
  await pool.execute(
    "UPDATE res_orders SET payment_id = ?, payment_status = ? WHERE order_id = ?",
    [data.payment_id, data.payment_status, data.order_id]
  );

  return true;
};

const getPackagePeriods = async (packageIds) => {
  const placeholders = packageIds.map(() => "?").join(",");
  const [periods] = await pool.execute(
    `SELECT package_id, period FROM res_download_packages WHERE package_id IN (${placeholders})`,
    packageIds
  );
  console.log(periods);
  return new Map(periods.map((p) => [p.package_id, p.period])); // Map for quick lookup
};

// create user if not present token

const createNewUser = async (user) => {
  // check if user already exists find by email

  const [existingUser] = await pool.execute(
    "SELECT * FROM res_users WHERE email = ?",
    [user.email]
  );

  if (existingUser.length > 0) {
    return existingUser[0].user_id;
  }

  // if not find create unique username and random password

  const username = user.email.split("@")[0] + Math.floor(Math.random() * 1000);
  const password = Math.random().toString(36).slice(-8);

  const [newUser] = await pool.execute(
    "INSERT INTO res_users (username, email, phone, password) VALUES (?, ?, ?, ?)",
    [
      username,
      user.email,
      user.phone,
      password,
    ]
  );

  return newUser.insertId;
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (userId, paymentId, orderId) => {
  try {
    const user = await getUserById(userId);

    if (!user || user.length === 0) {
      throw new Error("User not found.");
    }

    const userEmail = user[0].email || "mkverma541@gmail.com"; // Fallback to default email if none is present

    if (!userEmail) {
      throw new Error("No email address found for the user, and no fallback email provided.");
    }

    const emailSubject = "Order Confirmation";
    const emailBody = `
      Hi,<br><br>
      Your order has been confirmed.<br><br>
      Order ID: ${orderId}<br>
      Payment ID: ${paymentId}<br>
      Thank you for your purchase.
    `;

    await sendEmail(userEmail, emailSubject, emailBody);
    console.log(`Order confirmation email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error in sendOrderConfirmationEmail:", error.message);
    // Optionally, you could log the error or notify your team through a monitoring service
  }
};

module.exports = {
  getUserById,
  checkExistingPayment,
  fetchOrderDetails,

  getOrderIdByTransactionOrderId,
  fetchUserCart,
  getPackagePeriods,
  fetchTotalAmount,
  insertOrder,
  sendOrderConfirmationEmail,
  updatePaymentStatus,
  createNewUser,
};
