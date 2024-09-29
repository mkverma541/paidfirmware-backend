const express = require("express");
const { pool } = require("../../config/database");

async function transactions(req, res) {
  try {
    const [data] = await pool.execute("SELECT * FROM res_transactions");
    console.log(data);
    return res.status(200).json({
      data: data,
    });
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function addTransaction(order, user) {
  try {
    console.log(order, "order 21");
    console.log(user, "user 22");

    const payload = {
      user_id: user.id,
      username: user.username,
      amount: order.amount_paid,
      gateway: "razorpay",
      gateway_txn_id: order.id,
      gateway_response: order.id,
      date_create: new Date(),
    };

    await pool.execute(
      "INSERT INTO res_transactions (user_id, username, amount, gateway, gateway_txn_id, gateway_response, date_create) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        payload.user_id,
        payload.username,
        payload.amount,
        payload.gateway,
        payload.gateway_txn_id,
        payload.gateway_response,
        payload.date_create,
      ]
    );
  } catch (error) {
    console.error("Transaction addition error:", error);
    // Handle the error appropriately, e.g., throw or log it.
  }
}

module.exports = { transactions, addTransaction };
