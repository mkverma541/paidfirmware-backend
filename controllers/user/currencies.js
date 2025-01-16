const { pool } = require("../../config/database");

async function getCurrency(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.currency_code, c.rate, e.country_name  FROM res_currencies c
      LEFT JOIN res_exchange_rates e ON
      c.currency_code = e.currency_code
      WHERE c.status = 1`
    );

    res.status(200).json({
      data: rows,
      status: "success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

module.exports = {
  getCurrency,
};
