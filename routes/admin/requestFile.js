var express = require('express');
var router = express.Router();

const RequestFileController = require('../../controllers/admin/requestFile');

router.post('/create', RequestFileController.createRequestFile);
router.get('/list', RequestFileController.getRequestFiles);
router.put('/update/:id', RequestFileController.updateRequestFile);  

module.exports = router;
