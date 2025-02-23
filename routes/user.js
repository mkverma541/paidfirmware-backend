var express = require("express");
var router = express.Router();

const UserController = require("../controllers/user");

router.get("/", UserController.getUsers);
router.get("/test", UserController.insertTestUser);

module.exports = router;
