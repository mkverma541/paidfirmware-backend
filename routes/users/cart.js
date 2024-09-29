var express = require('express');
var router = express.Router();


const CartController = require('../../controllers/user/cart');
const authenticateUser = require('../../middlewars/authenticateToken');

router.post('/sync', authenticateUser, CartController.syncCart);
router.get('/', authenticateUser, CartController.getCart);

module.exports = router;
    