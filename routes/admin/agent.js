var express = require('express');
var router = express.Router();
const AgentController = require('../../controllers/admin/agent');

router.post('/create', AgentController.createAgent);
router.get('/', AgentController.getAgents);
router.put('/update/:id', AgentController.updateAgent);
router.delete('/delete/:id', AgentController.deleteAgent);

module.exports = router;
