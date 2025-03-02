var express = require('express');
var router = express.Router();

const ApiController = require('../controllers/api');

router.get('/countries', ApiController.getCountries);
router.get('/languages', ApiController.getLanguages);


module.exports = router;
    