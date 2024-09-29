const express = require("express");
const router = express.Router();

const RazorpayController = require("../../controllers/payment-gateway/razorpay");
const authenticateToken = require("../../middlewars/authenticateToken");

router.post("/create-order", authenticateToken, RazorpayController.createOrder);
router.post("/update/order", authenticateToken, RazorpayController.fetchPayment);

router.get("/orders", RazorpayController.fetchOrders);

module.exports = router;
