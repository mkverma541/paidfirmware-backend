const express = require("express");
const router = express.Router();

const geoLocationController = require("../controllers/api/geoLocation");
const exchangeRateController = require("../controllers/api/exchangeRate");

router.use("/get-location", geoLocationController.getUserLocation);
router.use("/get-exchange-rates", exchangeRateController.getAllCurrencyRates);

module.exports = router;
