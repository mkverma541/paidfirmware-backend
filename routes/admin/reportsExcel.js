var express = require('express');
var router = express.Router();

const ReportsController = require('../../controllers/admin/reportsExcel');

router.get('/transactions', ReportsController.getTransactions);
router.get('/downloads', ReportsController.getDownloadsHistory);
router.get('/wallet', ReportsController.getWalletTransactions);
router.get('/files', ReportsController.getAllFiles);
router.get('/packages', ReportsController.getPackages);
router.get('/download-visitors', ReportsController.getDownladsVisitors);
router.get('/staff-activities', ReportsController.getStaffActivity);
router.get('/ip-blacklist', ReportsController.getIpBlacklist);


module.exports = router;
 
