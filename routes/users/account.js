var express = require('express');
var router = express.Router();

const AccountController = require('../../controllers/user/account');
const authenticate = require('../../middlewars/authenticateToken');

router.get('/overview', authenticate, AccountController.getOverview);
router.get('/packages', authenticate,  AccountController.getPackages);
router.get('/downloads', authenticate, AccountController.getDownloadsHistory);
router.get('/download-file/:fileId', authenticate, AccountController.downloadFile);
router.get('/update-current-package/:packageId', authenticate, AccountController.updateCurrentPackage);

module.exports = router;
