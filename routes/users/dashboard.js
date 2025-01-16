var express = require('express');
var router = express.Router();

const DashboardController = require('../../controllers/user/dashboard');
const authenticateUser = require('../../middlewars/authenticateToken');

const cacheMiddleware = require("../../middlewars/redis");

router.get('/stats', authenticateUser, cacheMiddleware, DashboardController.getStats);

module.exports = router;
    