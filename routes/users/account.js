var express = require('express');
var router = express.Router();

const AccountController = require('../../controllers/user/account');
const authenticate = require('../../middlewars/authenticateToken');

router.get('/packages', authenticate,  AccountController.getPackages);
router.get('/orders', authenticate, AccountController.getOrders);
router.get('/orders/:orderId', authenticate, AccountController.getOrderDetails);
router.get('/order/:paymentId', authenticate, AccountController.getOrderDetailsByPaymentId);
router.get('/downloads', authenticate, AccountController.getDownloadsHistory);
router.get('/balance-history', authenticate, AccountController.getBalanceTransferHistory);
router.get('/download-file/:fileId', authenticate, AccountController.downloadFile);
router.get('/update-current-package/:packageId', authenticate, AccountController.updateCurrentPackage);

module.exports = router;
