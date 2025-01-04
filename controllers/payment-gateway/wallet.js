const { pool, secretKey } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { insertOrder, createNewUser } = require("./helper");

const { processOrder } = require("./processOrder");

async function createOrder(req, res) {
  try {
    const options = req.body;
    const { id } = req.user;

    // Check if user is logged in

    if (!id) {
      return res.status(401).json({
        status: "fail",
        message: "Please login to create an order.",
      });
    }

    const [userRows] = await pool.execute(
      "SELECT user_id, balance FROM res_users WHERE user_id = ?",
      [id]
    );

    if (!userRows.length) {
      return res.status(400).json({
        status: "fail",
        message: "User not found.",
      });
    }

    // get cart items

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

   // check if item_type is 5 // wallet payment then return error

    const walletItem = cartItems.find((item) => item.item_type === 5);

    if (walletItem) {
      return res.status(400).json({
        status: "fail",
        message: "Please choose another payment method for wallet top up recharge.",
      });
    }

    if (userRows[0].balance < +options.amount_due) {
      return res.status(400).json({
        status: "fail",
        message:
          "Insufficient funds. Please top up your wallet or use another payment method.",
      });
    }

    // restrict item 5 from being ordered for wallet payment

    // get the item_type unique values
    const itemTypes = [...new Set(cartItems.map((item) => item.item_type))];

    // Insert the order

    let payload = {
      user_id: id,
      transaction_order_id: null,
      ...options,
      payment_method: +options.payment_method,
      payment_paid: options.amount_due,
      item_types: JSON.stringify(itemTypes),
    };
    console.log("Payload", payload);

    const order = await insertOrder(payload);
    console.log("Order created successfully:", order);

    // debit user wallet and update balance and credit

    await pool.execute(
      "UPDATE res_users SET balance = balance - ? WHERE user_id = ?",
      [options.amount_due, id]
    );

    console.log("User wallet debited successfully:", id);

    // log the res_transfers table

    let description = "Debiting user wallet for order #" + order;

    await pool.execute(
      "INSERT INTO res_transfers (user_id, amount, order_id, type, notes, description) VALUES (?, ?, ?, ?, ?, ?)",
      [id, options.amount_due, order, "debit", "Order Paid", description]
    );

    console.log("User wallet debited successfully:", id);
    // Process the order
    console.log("Processing order:", order);

    await processOrder({
      user_id: id,
      order_id: order,
      payment_id: null,
      payment_status: 2,
    });

    // Respond with order details and full user information
    return res.json({
      order_id: order,
    });
  } catch (err) {
    console.error("Error creating order:", err.message);
    res.status(500).send({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

module.exports = { createOrder };
