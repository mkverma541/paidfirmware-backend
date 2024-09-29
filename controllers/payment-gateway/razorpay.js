const Razorpay = require("razorpay");
const { pool } = require("../../config/database");
const { processOrder } = require("./processOrder");

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
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body;
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

    if (order.status === "paid") {
      // Process the order if payment is successful
      await processOrder(
        user_id,
        razorpay_payment_id,
        razorpay_order_id,
        order,
        res
      );
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
