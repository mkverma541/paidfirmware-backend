const { pool } = require("../../config/database");

async function getCurrency(req, res) {
  try {
    
    const [rows] = await pool.query(
      `SELECT c.currency_code, c.id, c.status, c.prefix, c.suffix, c.rate, c.is_default, e.exchange_rate, e.country_name, e.last_updated_at FROM res_currencies c
      LEFT JOIN res_exchange_rates e ON
      c.currency_code = e.currency_code
      ORDER BY e.last_updated_at DESC`
    );
    res.status(200).json({
      data: rows,
      status: "success",
      last_updated_at: rows[0].last_updated_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}
async function addCurrency(req, res) {
  try {
    const { currency_code, status, prefix, suffix, rate } = req.body;

    // Check if the currency code already exists

    const [currencyExists] = await pool.query(
      `SELECT * FROM res_currencies WHERE currency_code = ?`,
      [currency_code]
    );

    if (currencyExists.length) {
      return res.status(400).json({
        status: "error",
        message: "Currency code already exists",
      });
    }
    
    const [rows] = await pool.query(
      `INSERT INTO res_currencies (currency_code, status, prefix, suffix, rate) VALUES (?, ?, ?, ?, ?)`,
      [currency_code, status, prefix, suffix, rate]
    );

    res.status(200).json({
      data: rows,
      status: "success",
      message: "Currency added successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function updateCurrency(req, res) {
  try {
    const {  status, prefix, suffix, rate, id } = req.body;

    if(!id){
      return res.status(400).json({
        status: "error",
        message: "Currency id is required",
      });
    }

    const [rows] = await pool.query(
      `UPDATE res_currencies SET status = ?, prefix = ?, suffix = ?, rate = ? WHERE id = ?`,
      [status, prefix, suffix, rate, id]
    );

    res.status(200).json({
      data: rows,
      status: "success",
      message: "Currency updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }       
}

async function deleteCurrency(req, res) {
  try {
    const { currency} = req.body;
    console.log(currency);

    // check is_default currency

    const [isDefaultCurrency] = await pool.query(
      `SELECT * FROM res_options WHERE option_name = 'currency' AND option_value = ?`,
      [currency]
    );
    

    if (isDefaultCurrency.length) {
      return res.status(400).json({
        status: "error",
        message: "Cannot delete default currency",
      });
    }
    
    await pool.query(
      `DELETE FROM res_currencies WHERE currency_code = ?`,
      [currency]
    );

    res.status(200).json({
      status: "success",
      message: "Currency deleted successfully",
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
  addCurrency,
  updateCurrency,
  deleteCurrency,

};
