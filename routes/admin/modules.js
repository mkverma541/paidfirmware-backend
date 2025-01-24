var express = require('express');
var router = express.Router();

const ModulesController = require('../../controllers/admin/modules');

router.get('/', ModulesController.getAllModules);

module.exports = router;
 
