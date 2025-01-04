const express = require('express');
const router = express.Router();
const downloadPackageController = require('../../controllers/admin/downloadPackage');

router.post('/create', downloadPackageController.addPackage);
router.get('/list', downloadPackageController.getPackages);
router.get('/:packageId', downloadPackageController.getPackageById);
router.put('/update', downloadPackageController.updatePackage)
router.delete('/delete/:packageId', downloadPackageController.deletePackage)


module.exports = router;  
