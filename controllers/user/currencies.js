const express = require('express');
const { pool } = require("../../config/database");
const NodeCache = require("node-cache");

const currencyCache = new NodeCache({ stdTTL: 0 }); // Cache indefinitely until cleared

async function getCurrencies(req, res) {
    // Check if currencies are already cached
    const cachedCurrencies = currencyCache.get("currencies");

    if (cachedCurrencies) {
        return res.status(200).send(cachedCurrencies); // Return cached data
    }

    try {
        // Fetch currencies with their exchange rates and base currency
        const query = `
            SELECT rc.*, rer.exchange_rate, rer.base_currency_code 
            FROM res_currencies rc
            LEFT JOIN res_exchange_rates rer ON rc.currency_code = rer.currency_code
        `;

        const [rows] = await pool.query(query);

        // Cache the result
        currencyCache.set("currencies", rows);

        res.status(200).send(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

// Function to clear the currency cache
function clearCurrencyCache() {
    currencyCache.del("currencies");
}

module.exports = {
    getCurrencies,
    clearCurrencyCache,
};
