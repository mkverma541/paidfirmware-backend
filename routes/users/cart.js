var express = require('express');
var router = express.Router();


const CartController = require('../../controllers/user/cart');
const authenticateUser = require('../../middlewars/authenticateToken');

router.post('/sync', CartController.syncCart);
router.post('/', authenticateUser, CartController.getCart);

module.exports = router;
    