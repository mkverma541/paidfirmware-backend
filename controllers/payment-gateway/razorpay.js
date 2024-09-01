require("dotenv").config();
const Razorpay = require("razorpay");
const { pool } = require("../../config/database");
const { addPurchasedPackage } = require("../users");
const { addTransaction } = require("../transactions");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createOrder(req, res) {
  const options = req.body;

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
  const orderID = req.params.id;
  const user = req.user;
  console.log(orderID, "Order ID");
  console.log(user, "User");

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await razorpay.orders.fetch(orderID);
    await addTransaction(order, user);
    

    const packageID = order.notes?.package_id;

    console.log(order, "Order");

    if (order.status === "paid") {
      await addPurchasedPackage(connection, user, packageID, res);

      await connection.commit();
    }
  } catch (error) {
    console.error(error);

    await connection.rollback();

    res.status(500).json({
      error: error.message || "Internal Server Error",
    });
  } finally {
    connection.release();
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
      error: error,
    });
    console.log(err);
  }
}

module.exports = { createOrder, fetchPayment, fetchOrders };
