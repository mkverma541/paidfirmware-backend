var express = require('express');
var router = express.Router();

const RequestFileController = require('../../controllers/admin/requestFile');

router.post('/create', RequestFileController.createRequestFile);
router.get('/', RequestFileController.getRequestFiles);

module.exports = router;
