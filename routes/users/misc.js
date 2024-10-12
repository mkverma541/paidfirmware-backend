var express = require('express');
var router = express.Router();

const MiscController = require('../../controllers/user/misc');

router.get('/:slug',  MiscController.getMisc);

module.exports = router;
    