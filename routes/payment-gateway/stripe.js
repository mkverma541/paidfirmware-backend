const express = require('express');
const router = express.Router();

const StripeController = require('../../controllers/payment-gateway/stripe');

router.post('/create-session', StripeController.createSession);
router.get('/payments/:id',  StripeController.fetchPayment);

module.exports = router;
