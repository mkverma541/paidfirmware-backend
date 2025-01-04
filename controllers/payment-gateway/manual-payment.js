const { pool, secretKey } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { insertOrder, createNewUser } = require("./helper");
const getUserIdFromToken = require("../utils/verify-user-token");

const { processOrder } = require("./processOrder");

async function createOrder(req, res) {
  try {
    const options = req.body;
    const token = req.headers.authorization;
    const { cartHash = false } = req.body;

    let user_id, user_details;

    // If cartHash is present, create a new user and get the user ID
    if (cartHash) {
      user_id = await createNewUser(req.body);
    }

    // If token is provided, extract the user ID from it
    if (token) {
      const tokenResult = await getUserIdFromToken(token);

      if (tokenResult.error) {
        return res.status(403).json({
          status: "fail",
          message: tokenResult.error,
        });
      }

      user_id = tokenResult.user_id;
    }


    // Retrieve user details based on the user ID
    const [userRows] = await pool.execute(
      "SELECT user_id, username, email, fullname, first_name, last_name, phone, photo, balance, is_verified FROM res_users WHERE user_id = ?",
      [user_id]
    );

    if (userRows.length) {
      user_details = { ...userRows[0] };
    }

    // Generate token for user details if not already present (for new user)
    if (!user_details?.token) {
      const newToken = jwt.sign(
        { id: user_id, username: user_details?.username || "Unknown" },
        secretKey,
        { expiresIn: "30d" }
      );

      user_details = { ...user_details, token: newToken };
    }

    // Update `user_id` in the res_cart table and remove cart_hash
    if (cartHash) {
      await pool.execute(
        "UPDATE res_cart SET user_id = ? WHERE cart_hash = ?",
        [user_id, cartHash]
      );
    }

    // Ensure user_id is present before proceeding
    if (!user_id) {
      return res.status(400).json({
        status: "fail",
        message: "User ID could not be determined.",
      });
    }

    // get cart items

    const [cartItems] = await pool.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [user_id]
    );

    if (!cartItems.length) {

      return res.status(400).json({
        status: "fail",
        message: "No items in cart.",
      });

    }

    // get the item_type unique values

    const itemTypes = [...new Set(cartItems.map((item) => item.item_type))];
    
    // Insert the order

    let payload = {
      user_id: user_id,
      transaction_order_id: null,
      ...options,
      amount_paid: 0,
      item_types: JSON.stringify(itemTypes),
    };

    console.log("Payload", payload);
    const order = await insertOrder(payload);
    

    // Respond with order details and full user information
    return res.json({
      user: user_details,
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

async function confirmOrder(req, res) {
  const { id } = req.user;
  const { order_id } = req.body;
  console.log("Order ID", order_id);

  try {
    const [order] = await pool.execute(
      "SELECT * FROM res_orders WHERE order_id = ? AND user_id = ?",
      [order_id, id]
    );

    if (!order.length) {
      return res.status(404).json({
        status: "fail",
        message: "Order not found.",
      });
    }
 
    let payload = {
      user_id: id,
      order_id: order_id,
      payment_id: null,
      payment_status: 1,
    }

    console.log("Payload", payload);

    await processOrder(payload);

    return res.json({
      status: "success",
      message: "Order confirmed successfully.",
    });
  } catch (err) {
    console.error("Error confirming order:", err.message);
    res.status(500).send({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

module.exports = { createOrder, confirmOrder };
