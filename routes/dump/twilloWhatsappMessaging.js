var express = require('express');
var router = express.Router();

const TwilloWAController = require('../controllers/twilloWhatsappMessaging');

router.post('/send-otp',  TwilloWAController.sendOTP);
router.post('/verify-otp',  TwilloWAController.verifyOTP);

module.exports = router;
 