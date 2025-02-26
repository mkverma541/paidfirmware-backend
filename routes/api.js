var express = require('express');
var router = express.Router();

const ApiController = require('../controllers/api');

router.get('/countries', ApiController.getCountries);


module.exports = router;
    