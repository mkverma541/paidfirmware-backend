const express = require("express");
const router = express.Router();

const MenuController = require("../../controllers/user/menu");

router.get("/", MenuController.getMenus);
router.get('/clear-cache', MenuController.clearMenuCache);

module.exports = router;
