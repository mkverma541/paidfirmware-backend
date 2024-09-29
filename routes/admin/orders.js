var express = require('express');
var router = express.Router();

const OrdersController = require('../../controllers/admin/orders');

router.get('/orders', OrdersController.getAllOrderList);

module.exports = router;
 
