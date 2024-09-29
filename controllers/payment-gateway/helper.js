const { pool } = require("../../config/database");

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
    "SELECT package_id, file_id FROM res_cart WHERE user_id = ?",
    [userId]
  );
  return userCart;
};

// Fetch package periods for the cart items
const getPackagePeriods = async (packageIds) => {
  const placeholders = packageIds.map(() => '?').join(',');
  const [periods] = await pool.execute(
    `SELECT package_id, period FROM res_download_packages WHERE package_id IN (${placeholders})`,
    packageIds
  );
  return new Map(periods.map(p => [p.package_id, p.period]));
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (userId, orderId, paymentId, amount) => {
  const user = await getUserById(userId);
  const userEmail = user[0].email;
  console.log(user);

  const emailSubject = "Order Confirmation";
  const emailBody = `
    Hi,<br><br>
    Your order has been confirmed.<br><br>
    Order ID: ${orderId}<br>
    Payment ID: ${paymentId}<br>
    Amount: ${amount / 100}<br><br>
    Thank you for your purchase.
  `;
  await sendEmail(userEmail, emailSubject, emailBody);
};

module.exports = {
  getUserById,
  checkExistingPayment,
  fetchOrderDetails,
  fetchUserCart,
  getPackagePeriods,
  sendOrderConfirmationEmail
};
