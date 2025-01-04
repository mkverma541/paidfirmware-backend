var express = require('express');
var router = express.Router();

const OrdersController = require('../../controllers/admin/orders');

router.get('/list', OrdersController.getAllOrderList);
router.get('/:order_id', OrdersController.getOrderDetails);

module.exports = router;
 
