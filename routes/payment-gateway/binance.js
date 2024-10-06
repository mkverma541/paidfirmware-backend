const express = require("express");
const router = express.Router();

const BinanceController = require("../../controllers/payment-gateway/binance");
const authenticateToken = require("../../middlewars/authenticateToken");

router.post("/create-order", BinanceController.createOrder);
router.post("/check-payment-status", BinanceController.checkPaymentStatus);
// router.post("/update/order", authenticateToken, RazorpayController.fetchPayment);

// router.get("/orders", RazorpayController.fetchOrders);

module.exports = router;
