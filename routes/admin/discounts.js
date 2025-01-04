var express = require('express');
var router = express.Router();

const DiscountController = require('../../controllers/admin/discounts');
const authenticateToken = require('../../middlewars/authenticateToken');

router.post('/create', DiscountController.create);
router.get('/list', DiscountController.getList);
router.get('/:id', DiscountController.getDiscount);
router.put('/update', DiscountController.update);
router.delete('/delete/:id', DiscountController.remove);

module.exports = router;
 