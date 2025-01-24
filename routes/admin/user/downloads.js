var express = require('express');
var router = express.Router();

const DownloadsController = require('../../../controllers/admin/user/downloads');

router.get('/',  DownloadsController.getDownloadsHistory);

module.exports = router;
