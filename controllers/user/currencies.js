const { pool } = require("../../config/database");

async function getCurrencies(req, res) {
  try {
    const query = `
          SELECT rc.*, rer.exchange_rate, rer.base_currency_code 
          FROM res_currencies rc
          LEFT JOIN res_exchange_rates rer ON rc.currency_code = rer.currency_code
        `;

    const [rows] = await pool.query(query);

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  getCurrencies,
};
