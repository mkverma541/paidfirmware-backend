var express = require('express');
var router = express.Router();

const UserController = require('../../controllers/admin/users');

router.get('/', UserController.getAllUserList);
router.post('/add', UserController.addNewUser);
router.get('/check-username/:username', UserController.checkUsername);
router.put('/update', UserController.updateUser);

module.exports = router;
 
