const express = require("express");
const router = express.Router();

const settingController = require("../../controllers/admin/settings");

router.use("/", settingController.getAllOptions);

module.exports = router;
