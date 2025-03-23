var express = require('express');
var router = express.Router();

const CMSController = require('../../controllers/user/cms');
const cacheMiddleware = require("../../middlewars/redis");

router.get('/banners', cacheMiddleware,  CMSController.getCarouselBanner);


module.exports = router;
 