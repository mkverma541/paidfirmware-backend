var express = require('express');
var router = express.Router();

const PagesController = require('../../controllers/user/pages');
const cacheMiddleware = require("../../middlewars/redis");

router.get('/:slug',  cacheMiddleware, PagesController.getPages);

module.exports = router;
    