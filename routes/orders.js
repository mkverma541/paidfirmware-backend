var express = require('express');
var router = express.Router();

const OrdersController = require('../controllers/orders');

router.get('/orders',  OrdersController.orders);


module.exports = router;
 