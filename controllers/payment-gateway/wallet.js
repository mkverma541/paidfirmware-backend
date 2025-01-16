const { pool, secretKey } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { insertOrder, calculateOrderDetails } = require("./helper");

const { processOrder } = require("./processOrder");


async function createOrder(req, res) {
  const connection = await pool.getConnection(); // Get a transactional connection
  try {
    await connection.beginTransaction(); // Start a transaction

    const options = req.body;
    const { id } = req.user;

    // Validate user existence and balance
    const [userRows] = await connection.execute(
      "SELECT user_id, balance, currency FROM res_users WHERE user_id = ? FOR UPDATE",
      [id]
    );

    if (!userRows.length) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: "User not found.",
      });
    }

    const userBalance = +userRows[0].balance; // Ensure it's a number

    // Get cart items
    const [cartItems] = await connection.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [id]
    );

    if (!cartItems.length) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: "No items in cart.",
      });
    }

    // Check for restricted item_type (e.g., wallet recharge)
    const walletItem = cartItems.find((item) => item.item_type === 5);

    if (walletItem) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message:
          "Please choose another payment method for wallet top-up recharge.",
      });
    }

    // Get default currency of store
    const [settings] = await connection.execute(
      "SELECT * FROM res_options WHERE option_name = 'currency'"
    );

    if (!settings.length) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: "Currency setting not found.",
      });
    }

    const storeCurrency = settings[0].option_value; // Store's currency (INR)

    // Check if order currency matches wallet currency
    if (options.currency !== storeCurrency) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: `Please change the currency to ${storeCurrency} (your wallet currency) to proceed with the payment.`,
      });
    }

    // Calculate total amount in the order's currency
    const itemTypes = [...new Set(cartItems.map((item) => item.item_type))];

    const orderDetails = await calculateOrderDetails({
      cartItems,
      discountCode: options.discount_code,
      currency: options.currency,
    });

    if (!orderDetails || !orderDetails.amount_due || isNaN(orderDetails.amount_due)) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: "Invalid order details.",
      });
    }

    // Total amount in the order's currency
    const totalAmountDueInOrderCurrency = +orderDetails.amount_due;

    // Check if the wallet has enough balance
    if (totalAmountDueInOrderCurrency > userBalance) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: "Insufficient wallet balance.",
      });
    }

    // Prepare order payload
    let payload = {
      user_id: id,
      ...orderDetails,
      transaction_order_id: null,
      ...options,
      payment_method: 3, // Wallet payment method
      item_types: JSON.stringify(itemTypes),
    };

    // Insert order into the database
    const order = await insertOrder(payload);

    if (!order) {
      throw new Error("Failed to create order.");
    }

    // Debit user wallet
    const amountToDebit = totalAmountDueInOrderCurrency;

    // Ensure proper numeric values for debiting
    if (isNaN(amountToDebit)) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message: "Invalid payment amount.",
      });
    }

    await connection.execute( 
      "UPDATE res_users SET balance = balance - ? WHERE user_id = ?",
      [amountToDebit, id]
    );

    // Log wallet transaction
    const description = "Debiting user wallet for order #" + order;
    await connection.execute(
      "INSERT INTO res_transfers (user_id, amount,  order_id, type, notes, description) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        amountToDebit,
        order,
        "debit",
        "Order Paid",
        description,
      ]
    );

    // Update order status
    await connection.execute(
      "UPDATE res_orders SET payment_status = ?, amount_paid = ?, order_status = ?, payment_date = ? WHERE order_id = ?",
      [2, amountToDebit, 7, new Date(), order]
    );

    // Process the order
    await processOrder(order, id);

    // Commit transaction
    await connection.commit();

    return res.json({
      order_id: order,
    });
  } catch (err) {
    console.error("Error creating order:", err.message);

    if (connection) await connection.rollback(); // Rollback transaction on error

    res.status(500).send({
      status: "error",
      message: "Internal Server Error",
    });
  } finally {
    if (connection) await connection.release(); // Release the connection
  }
}



module.exports = { createOrder };
