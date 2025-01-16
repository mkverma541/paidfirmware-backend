var express = require("express");
var router = express.Router();

const CurrencyController = require("../../controllers/admin/currencies");
const exchangeRateController = require("../../controllers/admin/exchangeRates");

router.get("/", CurrencyController.getCurrency);

router.get("/all", exchangeRateController.getAllCurrencies);
router.get("/exchange-rates/latest", exchangeRateController.getLatestExchangeRates);
router.post("/add", CurrencyController.addCurrency);
router.put("/update", CurrencyController.updateCurrency);
router.delete("/delete", CurrencyController.deleteCurrency);
router.get("/sync", exchangeRateController.syncData);

module.exports = router;


