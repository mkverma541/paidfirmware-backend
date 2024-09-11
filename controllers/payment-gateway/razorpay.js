require("dotenv").config();
const Razorpay = require("razorpay");
const { pool } = require("../../config/database");
const { addTransaction } = require("../transactions");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../emailer");
const { addSeconds } = require("date-fns");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createOrder(req, res) {
  const options = req.body;
  console.log(options);
  try {
    const order = await razorpay.orders.create(options);
    console.log(order);

    res.json({
      status: "success",
      data: order,
    });
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
}


async function fetchPayment(req, res) {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  const { id } = req.user;
  const user_id = id;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Invalid payment details." });
  }

  const connection = await pool.getConnection(); // Get a database connection from the pool

  try {
    await connection.beginTransaction();

    // Check if the payment is already processed
    const [existingPayment] = await connection.execute(
      "SELECT * FROM res_orders WHERE payment_id = ?",
      [razorpay_payment_id]
    );

    if (existingPayment.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Payment already processed." });
    }

    // Fetch the order details from Razorpay
    const order = await razorpay.orders.fetch(razorpay_order_id);

    // Check if the user exists
    const [user] = await connection.execute(
      "SELECT * FROM res_users WHERE user_id = ?",
      [user_id]
    );

    if (user.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "User not found." });
    }

    // Fetch user cart and validate
    const [userCart] = await connection.execute(
      "SELECT package_id FROM res_cart WHERE user_id = ?",
      [user_id]
    );

    if (userCart.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Cart is empty." });
    }

    const packageIds = userCart.map(item => item.package_id);

    // Fetch period values for package_ids in the userCart
    const placeholders = packageIds.map(() => '?').join(','); // Create placeholders for IN clause
    const [periods] = await connection.execute(
      `SELECT package_id, period FROM res_download_packages WHERE package_id IN (${placeholders})`,
      packageIds
    );

    if (periods.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "No matching packages found." });
    }

    const periodsMap = new Map(periods.map(p => [p.package_id, p.period]));

    // Proceed with order processing if payment is successful
    if (order.status === "paid") {
      await connection.execute(
        "INSERT INTO res_orders (transaction_order_id, user_id, payment_id, total, status) VALUES (?, ?, ?, ?, ?)",
        [razorpay_order_id, user_id, razorpay_payment_id, order.amount, "paid"]
      );

      console.log(userCart);
      for (let i = 0; i < userCart.length; i++) {
        const packageId = userCart[i].package_id;
        const packagePeriod = periodsMap.get(packageId);
      
        if (packagePeriod) {
          const isActive = i === 0 ? 1 : 0;
          const isCurrent = i === 0 ? 1 : 0;
      
          // Calculate expiration date based on period
          const dateExpire = addSeconds(new Date(), packagePeriod);
      
          await connection.execute(
            "INSERT INTO res_upackages (user_id, package_id, is_active, is_current, date_expire) VALUES (?, ?, ?, ?, ?)",
            [user_id, packageId, isActive, isCurrent, dateExpire]
          );
        }
      }
      

      // Clear the user's cart
      await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [user_id]);

      await connection.commit();

      // Send email confirmation
      const emailSubject = "Order Confirmation";
      const emailBody = `
        Hi,<br><br>
        Your order has been confirmed.<br><br>
        Order ID: ${razorpay_order_id}<br>
        Payment ID: ${razorpay_payment_id}<br>
        Amount: ${order.amount / 100}<br><br>
        Thank you for your purchase. You can now download your packages.
      `;
      const email = user[0].email;
      await sendEmail(email, emailSubject, emailBody);

      return res.status(200).json({
        status: "success",
        message: "Payment processed successfully",
      });
    } else {
      throw new Error("Order status is not 'paid'.");
    }
  } catch (error) {
    await connection.rollback();
    console.error("Payment processing error:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    connection.release(); // Release the connection back to the pool
  }
}


async function fetchOrders(req, res) {
  try {
    const orders = await razorpay.orders.all();
    return res.status(200).json({
      status: "success",
      data: orders,
    });
    console.log(orders);
  } catch (err) {
    res.status(500).json({
      error: err,
    });
    console.log(err);
  }
}

module.exports = { createOrder, fetchPayment, fetchOrders };
