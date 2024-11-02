const express = require("express");
const router = express.Router();

const MenuController = require("../../controllers/user/menu");

router.get("/", MenuController.getMenus);

module.exports = router;
