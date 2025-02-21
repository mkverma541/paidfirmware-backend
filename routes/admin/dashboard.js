var express = require('express');
var router = express.Router();

const DashboardController = require('../../controllers/admin/dashboard');

router.get('/chart/users', DashboardController.getUserRegistrationChart);
router.get('/recent-users', DashboardController.getRecentUsers);
router.get('/recent-orders', DashboardController.getRecentOrders);
router.get('/stats', DashboardController.getStats);

module.exports = router;
 
