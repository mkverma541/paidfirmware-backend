const Razorpay = require("razorpay");
const { pool } = require("../../config/database");

const { insertOrder, getOrderIdByTransactionOrderId } = require("./helper");
const { processOrder } = require("./processOrder");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create a new order
async function createOrder(req, res) {
  const options = req.body;
  const { id } = req.user;

  try {
    const order = await razorpay.orders.create(options);

    await insertOrder(id, order.id, order.amount, "Razorpay", order.currency);

    // Send response with order details
    res.json({
      status: "success",
      data: order,
    });
  } catch (err) {
    console.error("Error creating Razorpay order:", err.message);
    res.status(500).send("Internal Server Error");
  }
}

// Fetch and verify payment
async function fetchPayment(req, res) {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body;
  const { id } = req.user;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Invalid payment details." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if the payment has already been processed
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
      const orderId = await getOrderIdByTransactionOrderId(razorpay_order_id);

      await processOrder(id, orderId, razorpay_payment_id, res);

      res.status(200).json({
        status: "success",
        message: "Payment processed successfully",
        order_id: orderId,
      });
    } else {
      await connection.rollback();
      return res.status(400).json({ error: "Payment not successful." });
    }

    await connection.commit(); // Commit the transaction if all went well
  } catch (error) {
    await connection.rollback();
    console.error("Payment processing error:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release(); // Release the connection back to the pool
  }
}

// Fetch all orders
async function fetchOrders(req, res) {
  try {
    const orders = await razorpay.orders.all();
    return res.status(200).json({
      status: "success",
      data: orders,
    });
  } catch (err) {
    console.error("Error fetching orders:", err.message);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
}

module.exports = { createOrder, fetchPayment, fetchOrders };
