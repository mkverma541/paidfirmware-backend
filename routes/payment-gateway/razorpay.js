const express = require("express");
const router = express.Router();

const RazorpayController = require("../../controllers/payment-gateway/razorpay");
const authenticateToken = require("../../middlewars/authenticateToken");

router.post("/razorpay/create-order", RazorpayController.createOrder);
router.get(
  "/razorpay/orders/:id/payment",
  authenticateToken,
  RazorpayController.fetchPayment
);
router.get("/razorpay/orders", RazorpayController.fetchOrders);

module.exports = router;
