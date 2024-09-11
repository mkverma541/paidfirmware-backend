var express = require('express');
var router = express.Router();

const CartController = require('../controllers/cart');

router.post('/cart/sync', CartController.syncCart);
router.get('/cart', CartController.getCart);

module.exports = router;
 