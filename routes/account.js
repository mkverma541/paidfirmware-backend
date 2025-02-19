var express = require("express");
var router = express.Router();

const AccountController = require("../controllers/account");
const AuthenticateToken = require("../middlewars/authenticateToken");

router.get("/profile", AuthenticateToken, AccountController.getUserProfile);

module.exports = router;
