const express = require("express");
const router = express.Router();

const currenciesController = require("../../controllers/user/currencies");

router.use("/", currenciesController.getCurrencies);

module.exports = router;
