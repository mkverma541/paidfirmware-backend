var express = require('express');
var router = express.Router();

const UserController = require('../controllers/users');

router.get('/users/list', UserController.getAllUsers);

module.exports = router;
 