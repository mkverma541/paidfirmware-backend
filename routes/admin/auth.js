var express = require("express");
var router = express.Router();

const {adminAuthController}  = require("../../controllers/admin/auth");

router.post("/register", adminAuthController.createAdmin);
router.post("/login", adminAuthController.login);

module.exports = router;
