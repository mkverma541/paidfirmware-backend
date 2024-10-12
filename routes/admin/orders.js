var express = require('express');
var router = express.Router();

const OrdersController = require('../../controllers/admin/orders');

router.get('/', OrdersController.getAllOrderList);

module.exports = router;
 
