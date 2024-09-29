var express = require('express');
var router = express.Router();

const DashboardController = require('../../controllers/admin/dashboard');

router.get('/chart/users', DashboardController.getUserRegistrationChart);

module.exports = router;
 
