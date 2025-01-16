const express = require("express");
const router = express.Router();

const MenuController = require("../../controllers/user/menu");
const cacheMiddleware = require("../../middlewars/redis");

router.get("/", cacheMiddleware, MenuController.getMenus);

module.exports = router;
