const { pool } = require("../config/database");

async function getCountries(req, res) {
  try {
    const [countries] = await pool.query("SELECT * FROM countries");
    res.status(200).json({ countries, status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

module.exports = {
  getCountries,
};
