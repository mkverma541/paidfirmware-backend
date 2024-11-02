var express = require('express');
var router = express.Router();

const CouponController = require('../../controllers/admin/coupons');
const authenticateToken = require('../../middlewars/authenticateToken');

router.post('/add', CouponController.addCoupon);
router.get('/', CouponController.getCoupons);
router.put('/update/:id', CouponController.updateCoupon);

module.exports = router;
 