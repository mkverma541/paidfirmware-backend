var express = require('express');
var router = express.Router();

const DownloadsPackageController = require('../../../controllers/user/account/downloadPackages');
const authenticate = require('../../../middlewars/authenticateToken');

router.get('/', authenticate,  DownloadsPackageController.getPackages);
router.get('/update', authenticate, DownloadsPackageController.updateCurrentPackage);

module.exports = router;
