const API_KEY = "85ecf65a0236de5aa7708d4b";
const BASE_URL = "https://v6.exchangerate-api.com/v6/";
const { pool } = require("../../config/database");
const axios = require("axios");

async function getAllCurrencies(req, res) {
  try {
    const [exchangeRates] = await pool.query(
      "SELECT country_name, currency_code, currency_symbol, exchange_rate FROM res_exchange_rates"
    );

    res.status(200).json({
      status: "success",
      message: "Currency rates fetched successfully",
      data: exchangeRates,
    });
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
}

async function getLatestExchangeRates(req, res) {
  try {
    // Get the base currency of the store
    const [storeBaseCurrency] = await pool.query(
      "SELECT option_value FROM res_options WHERE option_name = 'currency'"
    );

    if (!storeBaseCurrency.length || !storeBaseCurrency[0].option_value) {
      throw new Error("Base currency not found in the database");
    }

    const baseCurrency = storeBaseCurrency[0].option_value;

    // Fetch the currency rates from the API
    const response = await axios.get(
      `${BASE_URL}${API_KEY}/latest/${baseCurrency}`
    );

    if (!response.data || !response.data.conversion_rates) {
      throw new Error("Invalid response from the exchange rate API");
    }

    const rates = response.data.conversion_rates;
    const lastUpdatedAt = new Date(
      response.data.time_last_update_utc
    ).toISOString(); // Ensure valid ISO format

    // Update the table with the new currency rates
    for (const [currencyCode, exchangeRate] of Object.entries(rates)) {
      await pool.query(
        `INSERT INTO res_exchange_rates (currency_code, exchange_rate, base_currency_code, last_updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE exchange_rate = VALUES(exchange_rate), last_updated_at = VALUES(last_updated_at)`,
        [currencyCode, exchangeRate, baseCurrency, lastUpdatedAt]
      );
    }

    res.status(200).json({ message: "Currency rates updated successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
}


  

async function syncData(req, res) {
  try {
    //  update country_code in res_exchange_rates

    res.status(200).json({ message: "Data synced successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
}

module.exports = {
  getAllCurrencies,
  getLatestExchangeRates,
  syncData,
};
