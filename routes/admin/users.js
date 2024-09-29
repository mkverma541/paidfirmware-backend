var express = require('express');
var router = express.Router();

const UserController = require('../../controllers/admin/users');

router.get('/users', UserController.getAllUserList);

module.exports = router;
 
