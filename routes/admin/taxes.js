var express = require('express');
var router = express.Router();

const TaxController = require('../../controllers/admin/taxes');
const authenticateToken = require('../../middlewars/authenticateToken');

router.post('/add', TaxController.addTax);
router.get('/', TaxController.getTaxes);
router.put('/update/:id', TaxController.updateTax);

module.exports = router;
 