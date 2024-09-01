const express = require('express');
const router = express.Router();
const downloadPackageController = require('../controllers/downloadPackages');

router.get('/download-packages', downloadPackageController.getPackageDetails);


module.exports = router;  