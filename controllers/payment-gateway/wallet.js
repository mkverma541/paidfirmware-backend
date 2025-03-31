const { pool, secretKey } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { insertOrder, calculateOrderDetails } = require("./helper");
const { processOrder } = require("./processOrder");

async function createOrder(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.user;
    const options = req.body;
    const { currency, amount, discount_code } = options;

    // Validate user existence and balance
    const [userRows] = await connection.execute(
      "SELECT user_id, balance, currency FROM res_users WHERE user_id = ? FOR UPDATE",
      [id]
    );

    if (!userRows.length) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: "fail", message: "User not found." });
    }

    let userBalance = parseFloat(userRows[0].balance); // User balance in userCurrency
    const userCurrency = userRows[0].currency; // Dynamic user wallet currency (could be KWD, USD, etc.)

    // Get cart items
    const [cartItems] = await connection.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [id]
    );

    if (!cartItems.length) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: "fail", message: "No items in cart." });
    }

    // Prevent wallet recharge payment method
    if (cartItems.some((item) => item.item_type === 5)) {
      await connection.rollback();
      return res.status(400).json({
        status: "fail",
        message:
          "Please choose another payment method for wallet top-up recharge.",
      });
    }

    // Get default store currency
    const [settings] = await connection.execute(
      "SELECT option_value FROM res_options WHERE option_name = 'currency'"
    );

    if (!settings.length) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: "fail", message: "Currency setting not found." });
    }

    const storeCurrency = settings[0].option_value;

    // Get exchange rate for order currency (INR to storeCurrency)
    const [orderExchangeRateRows] = await connection.execute(
      "SELECT rate FROM res_currencies WHERE currency_code = ?",
      [currency]
    );

    const orderExchangeRate = orderExchangeRateRows.length
      ? parseFloat(orderExchangeRateRows[0].rate)
      : 1;

    // Get exchange rate for wallet currency (userCurrency)
    const [walletExchangeRateRows] = await connection.execute(
      "SELECT rate FROM res_currencies WHERE currency_code = ?",
      [userCurrency]
    );

    const walletExchangeRate = walletExchangeRateRows.length
      ? parseFloat(walletExchangeRateRows[0].rate)
      : 1;

    // Convert the order amount to the base currency (storeCurrency)
    const totalInBaseCurrency = parseFloat(amount) / orderExchangeRate;

    // Convert user's wallet balance to base currency (storeCurrency)
    const walletBalanceInBaseCurrency = userBalance / walletExchangeRate;

    // Check if the user has enough balance in their wallet
    if (walletBalanceInBaseCurrency < totalInBaseCurrency) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: "fail", message: "Insufficient wallet balance." });
    }

    // Calculate order details
    const orderDetails = await calculateOrderDetails({
      cartItems,
      discountCode: discount_code,
      currency,
    });

    if (!orderDetails || isNaN(orderDetails.amount_due)) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: "fail", message: "Invalid order details." });
    }

    const totalAmountDueInBaseCurrency =
      parseFloat(orderDetails.amount_due) /
      orderExchangeRate /
      walletExchangeRate;

    if (totalAmountDueInBaseCurrency > walletBalanceInBaseCurrency) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: "fail", message: "Insufficient wallet balance." });
    }

    // Prepare order payload
    const itemTypes = [...new Set(cartItems.map((item) => item.item_type))];
    let payload = {
      user_id: id,
      ...orderDetails,
      amount_due: parseFloat(orderDetails.amount_due), // Amount in order currency
      payment_method: 3, // Wallet payment method
      item_types: JSON.stringify(itemTypes),
    };

    // Insert order into the database
    const order = await insertOrder(payload);
    if (!order) throw new Error("Failed to create order.");

    // Debit user wallet with the converted amount in the user's wallet currency
    await connection.execute(
      "UPDATE res_users SET balance = balance - ? WHERE user_id = ?",
      [totalAmountDueInBaseCurrency, id]
    );

    // Log wallet transaction
    await connection.execute(
      "INSERT INTO res_transfers (user_id, amount, order_id, type, notes, description) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        totalInBaseCurrency, // Amount in base currency (storeCurrency)
        order,
        "debit",
        "Order Paid",
        `Debiting user wallet for order #${order}`,
      ]
    );

    // insert transaction details into the database

    const transaction = await connection.execute(
      "INSERT INTO res_transactions (order_id, user_id, amount, gateway_id, gateway_txn_id, gateway_response, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        order,
        id,
        parseFloat(orderDetails.amount_due), // Amount in order currency
        4, // Wallet payment method
        null, // Gateway transaction ID (not applicable for wallet payments)
        null, // Gateway response (not applicable for wallet payments)
        4, // Transaction status (4 for successful payment)
      ]
    );

    const transactionId = transaction[0].insertId;

    // Update order status
    await connection.execute(
      "UPDATE res_orders SET payment_status = ?, amount_paid = ?, order_status = ?, transaction_id = ? WHERE order_id = ?",
      [2, parseFloat(orderDetails.amount_due), 7, transactionId, order]
    );

    // Process the order
    await processOrder(order, id);

    // Commit transaction
    await connection.commit();

    return res.json({ order_id: order });
  } catch (err) {
    console.error("Error creating order:", err.message);
    if (connection) await connection.rollback();
    res.status(500).send({ status: "error", message: "Internal Server Error" });
  } finally {
    if (connection) await connection.release();
  }
}

module.exports = { createOrder };
