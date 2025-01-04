const express = require("express");
const router = express.Router();

const { cacheJson } = require("../../middlewars/cacheMiddleware");
const currenciesController = require("../../controllers/user/currencies");

router.use("/", cacheJson, currenciesController.getCurrencies);

module.exports = router;
