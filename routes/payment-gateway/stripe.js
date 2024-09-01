const express = require('express');
const router = express.Router();

const StripeController = require('../../controllers/payment-gateway/stripe');

router.post('/stripe/create-session', StripeController.createSession);
router.get('/stripe/payments/:id',  StripeController.fetchPayment);

module.exports = router;
