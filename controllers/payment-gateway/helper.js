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

  return totalAmount;  // Return only the number
};


const insertOrder = async (userId, transactionOrderId, amount, paymentGateway, currency, ) => {
  const [order] = await pool.execute(
    "INSERT INTO res_orders (user_id, transaction_order_id, total, payment_gateway, currency) VALUES (?, ?, ?, ?, ?)",
    [userId, transactionOrderId, amount, paymentGateway, currency]
  );
  return order.insertId;
};

const getOrderIdByTransactionOrderId = async (transactionOrderId) => {
  const [order] = await pool.execute(
    "SELECT order_id FROM res_orders WHERE transaction_order_id = ?",
    [transactionOrderId]
  );
  console.log(order);
  return order[0].order_id;
}

const updatePaymentStatus = async (paymentId, orderId) => {
 
  const [order] = await pool.execute(
    "UPDATE res_orders SET payment_id = ?, status = 'PAID' WHERE order_id = ?",
    [paymentId, orderId]
  );

  return true;
}



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
const sendOrderConfirmationEmail = async (userId, paymentId, orderId) => {
  const user = await getUserById(userId);
  const userEmail = user[0].email;
  console.log(user);

  const emailSubject = "Order Confirmation";
  const emailBody = `
    Hi,<br><br>
    Your order has been confirmed.<br><br>
    Order ID: ${orderId}<br>
    Payment ID: ${paymentId}<br>
    Thank you for your purchase.
  `;
  await sendEmail(userEmail, emailSubject, emailBody);
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
  updatePaymentStatus
};
