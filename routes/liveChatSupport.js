var express = require('express');
var router = express.Router();

const LiveChatController = require('../controllers/liveChatSupport');
const authenticateToken = require('../middlewars/authenticateToken');

router.post('/message', UserController.register);
router.post('/login', UserController.login);
router.get('/users', authenticateToken, UserController.users);


module.exports = router;
 