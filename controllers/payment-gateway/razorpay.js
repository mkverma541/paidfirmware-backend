const Razorpay = require("razorpay");
const { pool } = require("../../config/database");

const { insertOrder, calculateOrderDetails } = require("./helper");
const { processOrder } = require("./processOrder");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create a new order
async function createOrder(req, res) {
  try {
    const options = req.body;
    const { id } = req.user;

    if (!options || !options.amount || !options.currency) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid input: Amount and currency are required.",
      });
    }

    // Get cart items
    const [cartItems] = await pool.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [id]
    );

    if (!cartItems.length) {
      return res.status(400).json({
        status: "fail",
        message: "No items in cart.",
      });
    }

    const orderDetails = await calculateOrderDetails({
      cartItems,
      discountCode: options.discount_code,
      currency: options.currency,
    });


    // Get the unique item_type values
    const itemTypes = [...new Set(cartItems.map((item) => item.item_type))];

    // Create Razorpay order
    const order = await razorpay.orders.create(options);

    if (!order) {
      res.status(500).json({
        status: "fail",
        message: "Failed to create Razorpay order.",
      });
    }

    // Prepare payload for database insertion
    const payload = {
      user_id: id,
      ...orderDetails,
      transaction_order_id: order.id,
      amount_paid: order.amount_paid,
      payment_method: 1, // Example: hardcoded; update as needed
      notes: options.notes || null,
      item_types: JSON.stringify(itemTypes),
    };

    // Insert the order into the database
    const orderId = await insertOrder(payload);

    // Send response with order details
    return res.json({
      status: "success",
      data: order,
      order_id: orderId,
    });
  } catch (err) {
    return res.status(500).json({
      status: "fail",
      message: "Internal Server Error",
    });
  }
}

// Fetch and verify payment

async function fetchPayment(req, res) {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    order_id,
  } = req.body;
  const { id } = req.user;

  // Validate request body
  if (
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature ||
    !order_id
  ) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid payment details.",
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // verify that the order exists and belongs to the user

    const [existingOrder] = await connection.execute(
      "SELECT * FROM res_orders WHERE order_id = ? AND user_id = ?",
      [order_id, id]
    );

    if (existingOrder.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: "Invalid order.",
      });
    }

    const order = existingOrder[0];

    // check if the payment is already processed

    if (order.payment_status === 2) {
      await connection.commit();

      return res.status(200).json({
        status: "success",
        message: "Payment already processed.",
        order_id: order_id,
      });
    }

    // fetch and validate the payment from Razorpay

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (!payment || payment.status !== "captured") {
      await connection.rollback();

      return res.status(400).json({
        status: "fail",
        message: "Payment verification failed or payment not captured.",
      });
    }

    // Update the payment status in the database

    const paidAmount = payment.amount / 100; // Convert amount to base currency

    await connection.execute(
      "UPDATE res_orders SET payment_id = ?, payment_status = ?, amount_paid = ?, order_status = ?, payment_date = ? WHERE order_id = ?",
      [payment.id, 2, paidAmount, 7, new Date(), order_id]
    );

    // Process the order
    await processOrder(order_id, id);  

    await connection.commit();

    return res.status(200).json({
      status: "success",
      order_id: order_id,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Payment processing error:", error.message);

    return res.status(500).json({
      status: "fail",
      message: "Internal Server Error. Please try again later.",
    });
  } finally {
    connection.release(); // Always release the database connection
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
