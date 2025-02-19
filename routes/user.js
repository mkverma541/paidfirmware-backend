var express = require("express");
var router = express.Router();

const UserController = require("../controllers/user");

router.get("/", UserController.getUsers);

module.exports = router;
