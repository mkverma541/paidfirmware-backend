const express = require("express");
const router = express.Router();

const locationController = require("../controllers/api/location");
const settingController = require("../controllers/api/settings");

const cacheMiddleware = require("../middlewars/redis");

router.use("/get-location", locationController.getUserLocation);
router.use("/settings", cacheMiddleware, settingController.getAllOptions);




module.exports = router;
