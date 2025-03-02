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

async function getLanguages(req, res) {
  try {
    const [languages] = await pool.query("SELECT * FROM languages");
    res.status(200).json({ data:languages, status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

module.exports = {
  getCountries,
  getLanguages,
};
