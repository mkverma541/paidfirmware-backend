const express = require('express');
const { pool } = require("../../config/database");

async function getCurrencies(req, res) {
    try {
        // Fetch currencies with their exchange rates and base currency
        const query = `
            SELECT rc.*, rer.exchange_rate, rer.base_currency_code 
            FROM res_currencies rc
            LEFT JOIN res_exchange_rates rer ON rc.currency_code = rer.currency_code
        `;

        const [rows, fields] = await pool.query(query);
        res.status(200).send(rows);
    
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
}

module.exports = {
    getCurrencies
};
