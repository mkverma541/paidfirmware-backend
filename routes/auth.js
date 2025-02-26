var express = require('express');
var router = express.Router();

const AuthController = require('../controllers/auth');
const AuthMiddleware = require('../middlewars/authenticateToken');

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/otp/verify', AuthController.verifyOtp);
router.post('/otp/resend', AuthController.resendOtp);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/change-password', AuthMiddleware, AuthController.changePassword);
router.get('/check-username/:username', AuthController.checkUsername);


module.exports = router;
    