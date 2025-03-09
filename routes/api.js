const express = require("express");
const router = express.Router();

const locationController = require("../controllers/api/location");
const settingController = require("../controllers/api/settings");
const countriesController = require("../controllers/api/countries");

const cacheMiddleware = require("../middlewars/redis");

router.use("/get-location", locationController.getUserLocation);
router.use("/settings", cacheMiddleware, settingController.getAllOptions);
router.get("/countries", countriesController.getCountries);
router.post("/states", countriesController.getStates);
router.post("/cities", countriesController.getCities);



module.exports = router;
