const API_KEY = '85ecf65a0236de5aa7708d4b';
const BASE_URL = 'https://v6.exchangerate-api.com/v6/';
const { pool } = require("../../config/database");

async function getAllCurrencyRates(req, res) {
    const baseCurrency = 'USD';

    try {
        // Fetch conversion rates from the API
        const response = await fetch(`${BASE_URL}${API_KEY}/latest/${baseCurrency}`);
        const data = await response.json();

        if (data && data.conversion_rates) {
            console.log(`Conversion rates based on ${baseCurrency}:`);
            
            // Iterate through each currency rate and log it
            for (const [currency, rate] of Object.entries(data.conversion_rates)) {
                console.log(`1 ${baseCurrency} = ${rate} ${currency}`);
                
                // Insert or update each currency rate in the database
                await pool.execute(
                    `INSERT INTO res_exchange_rates (currency_code, exchange_rate, base_currency_code, rate_date)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE exchange_rate = ?, rate_date = ?`,
                    [currency, rate, baseCurrency, new Date().toISOString().split('T')[0], rate, new Date().toISOString().split('T')[0]]
                );
            }

            // Optional: Send a success response
            res.status(200).json({ message: 'Currency rates updated successfully', rates: data.conversion_rates });
        } else {
            console.error('Error fetching conversion rates:', data);
            res.status(500).json({ error: 'Error fetching conversion rates' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    getAllCurrencyRates,
};
