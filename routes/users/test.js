var express = require("express");
var router = express.Router();

const TestController = require("../../controllers/user/test");

router.post("/transfer", TestController.balanceTransfer);

module.exports = router;
