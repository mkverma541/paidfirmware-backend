var express = require('express');
var router = express.Router();

const UserController = require('../controllers/users');
const authenticateToken = require('../middlewars/authenticateToken');

router.post('/users/register', UserController.register);
router.post('/user/login', UserController.login);
router.get('/user/account', authenticateToken,  UserController.account);
router.get('/user/profile', authenticateToken,  UserController.profile);
router.get('/user/package', authenticateToken,  UserController.userDownloadPackages);
router.get('/user/downloads', authenticateToken,  UserController.downloads);
router.get('/user/orders', authenticateToken,  UserController.orders);
router.get('/user/invoices', authenticateToken,  UserController.invoices);
router.get('/user/transactions', authenticateToken,  UserController.transactions);
router.get('/user/transfers', authenticateToken,  UserController.transfers);
router.get('/user/invoice/:id', authenticateToken,  UserController.getInvoiceById);
router.get('/user/order/:id', authenticateToken,  UserController.getOrderById);
router.post('/user/social-login',  UserController.socialLogin);
router.get('/user/validate/download-file', authenticateToken,  UserController.isValidate);

router.get('/admin/users', UserController.getAllUsers);

module.exports = router;
 