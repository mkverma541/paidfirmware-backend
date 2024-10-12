const express = require('express');
const router = express.Router();
const downloadPackageController = require('../../controllers/user/downloadPackages');

router.get('/', downloadPackageController.getPackageDetails);
router.get('/:id', downloadPackageController.getPackages);

module.exports = router;  