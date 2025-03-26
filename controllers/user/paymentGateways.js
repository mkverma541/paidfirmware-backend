const { pool } = require("../../config/database");

async function getPaymentMethod(req, res) {
  try {
    const [paymentMethods] = await pool.execute(
      "SELECT * FROM payment_gateways WHERE status = 1 ORDER BY position ASC");

    if (paymentMethods.length === 0) {
      return res.status(404).json({ error: "No payment methods found" });
    }

    res.status(200).json({ status: "success", data: paymentMethods });

  }
    catch (error) {
        console.error("Error fetching payment methods:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

module.exports = {
  getPaymentMethod,
};


