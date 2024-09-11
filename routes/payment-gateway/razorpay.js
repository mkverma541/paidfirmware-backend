const express = require("express");
const router = express.Router();

const RazorpayController = require("../../controllers/payment-gateway/razorpay");
const authenticateToken = require("../../middlewars/authenticateToken");

router.post("/razorpay/create-order", authenticateToken, RazorpayController.createOrder);
router.post("/razorpay/update/order", authenticateToken, RazorpayController.fetchPayment);

router.get("/admin/razorpay/orders", RazorpayController.fetchOrders);

module.exports = router;
