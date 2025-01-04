const express = require("express");
const router = express.Router();
const { cacheJson } = require('../../middlewars/cacheMiddleware');

const MenuController = require("../../controllers/user/menu");

router.get("/", cacheJson, MenuController.getMenus);

module.exports = router;
