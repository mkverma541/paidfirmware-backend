const express = require("express");
const router = express.Router();

// Import the payment gateway routes
const razorpayRoutes = require("./razorpay");
const binanceRoutes = require("./binance");
const manualPaymentRoutes = require("./manual-payment");
const walletRoutes = require("./wallet");

// const stripeRoutes = require("./stripe");

// Use the routes
router.use("/razorpay", razorpayRoutes);
router.use("/binance", binanceRoutes);
router.use("/manual", manualPaymentRoutes);
router.use("/account-balance", walletRoutes);

// router.use("/stripe", stripeRoutes);

module.exports = router;
