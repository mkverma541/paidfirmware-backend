var express = require('express');
var router = express.Router();

const ReportsController = require('../../controllers/admin/reports');

router.get('/transactions', ReportsController.getTransactions);
router.get('/downloads', ReportsController.getDownloadsHistory);
router.get('/wallet', ReportsController.getWalletTransactions);
router.get('/files', ReportsController.getAllFiles);
router.get('/packages', ReportsController.getPackages);
router.get('/download-visitors', ReportsController.getDownladsVisitors);
router.get('/staff-activities', ReportsController.getStaffActivity);
router.get('/ip-blacklist', ReportsController.getIpBlacklist);

router.get("/transactions/download/excel", ReportsController.downloadTransactionsExcel);
router.get('/wallet/download/excel', ReportsController.downloadWalletTransactionsExcel);

module.exports = router;
 
