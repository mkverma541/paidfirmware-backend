var express = require('express');
var router = express.Router();

const LiveChatController = require('../controllers/liveChatSupport');
const authenticateToken = require('../../middlewars/authenticateToken');

router.post('/message', UserController.register);


module.exports = router;
 