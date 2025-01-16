const express = require("express");
const router = express.Router();

const CurrencyController = require("../../controllers/user/currencies");
const cacheMiddleware = require("../../middlewars/redis");

router.get("/", cacheMiddleware, CurrencyController.getCurrency);

module.exports = router;
