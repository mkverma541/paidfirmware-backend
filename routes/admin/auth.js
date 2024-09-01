var express = require("express");
var router = express.Router();

const {adminAuthController}  = require("../../controllers/admin/auth");

router.post("/auth/register", adminAuthController.createAdmin);
router.post("/auth/login", adminAuthController.login);

module.exports = router;
