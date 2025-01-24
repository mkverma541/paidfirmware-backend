var express = require('express');
var router = express.Router();

const DownloadsPackageController = require('../../../controllers/admin/user/downloadPackages');

router.get('/',  DownloadsPackageController.getPackages);
router.get('/update',  DownloadsPackageController.updateCurrentPackage);

module.exports = router;
