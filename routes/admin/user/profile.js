var express = require("express");
var router = express.Router();

const ProfileControllers = require("../../../controllers/admin/user/profile");

router.get("/",  ProfileControllers.getProfile);


module.exports = router;
