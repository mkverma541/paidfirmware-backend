var express = require('express');
var router = express.Router();

const AgentsController = require('../../controllers/user/agents');

router.get('/', AgentsController.getAgents);


module.exports = router;
 