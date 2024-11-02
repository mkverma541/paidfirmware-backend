var express = require('express');
var router = express.Router();

const AccountController = require('../../controllers/admin/userAccount');

router.get('/profile/:userId',  AccountController.getProfile);
router.get('/packages/:userId',  AccountController.getPackages);
router.get('/orders/:userId',  AccountController.getOrders);
router.get('/downloads/:userId',  AccountController.getDownloadsHistory);
router.get('/transfers/:userId',  AccountController.getBalanceTransferHistory);
router.get('/orders/:orderId',  AccountController.getOrderDetails);
router.get('/order/:paymentId',  AccountController.getOrderDetailsByPaymentId);
router.get('/download-file/:fileId',  AccountController.downloadFile);
router.get('/update-current-package/:packageId',  AccountController.updateCurrentPackage);

module.exports = router;
 
