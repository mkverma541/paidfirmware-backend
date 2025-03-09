var express = require('express');
var router = express.Router();

const AuthController = require('../../controllers/user/auth');

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/otp/verify', AuthController.verifyOtp);
router.post('/otp/resend', AuthController.resendOtp);
router.post('/social-login', AuthController.socialLogin);
router.post('/facebook-login', AuthController.facebookSocialLogin);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.get('/check-username-email/:email', AuthController.checkEmailOrUsername);
router.post('/checkout-login', AuthController.checkoutLogin);

module.exports = router;
    