var express = require('express');
var router = express.Router();

const PartyController = require('../controllers/parties');
const authenticateToken = require('../../middlewars/authenticateToken');

router.post('/add', authenticateToken, PartyController.register);
router.get('/list', authenticateToken, PartyController.list);
router.get('/:id', authenticateToken, PartyController.getById);


module.exports = router;
 