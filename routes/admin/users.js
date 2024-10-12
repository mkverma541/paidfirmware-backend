var express = require('express');
var router = express.Router();

const UserController = require('../../controllers/admin/users');

router.get('/', UserController.getAllUserList);

module.exports = router;
 
