const { pool } = require("../../config/database");

async function checkDiscount(req, res) {
  try {
    const { id } = req.user;
    const { discount_code, currency } = req.body;
    let discount = [];

    // Check for discount code and retrieve discount details if provided
    if (discount_code) {
      const [discountResult] = await pool.execute(
        `SELECT * FROM res_coupons WHERE code = ?`,
        [discount_code]
      );
      discount = discountResult;
    }

    // If a discount code was provided and no valid discount is found, return an error
    if (discount_code && discount.length === 0) {
      return res.status(400).json({ error: "Invalid discount code" });
    }

    // Fetch cart items for the user
    const [cartItems] = await pool.execute(
      `SELECT c.package_id, c.file_id, c.quantity, p.*, f.*
                FROM res_cart c
                LEFT JOIN res_download_packages p ON c.package_id = p.package_id
                LEFT JOIN res_files f ON c.file_id = f.file_id
                WHERE c.user_id = ?`,
      [id]
    );

    console.log(cartItems);

    // Calculate the subtotal price of the cart in the base currency
    let subTotal = cartItems.reduce((acc, item) => {
      const price = item.price || 0; // Replace 'price' with the actual price field name
      const quantity = item.quantity || 1;
      return acc + price * quantity;
    }, 0);

    // Fetch the exchange rate for the provided currency
    const [exchangeRateResult] = await pool.execute(
      `SELECT exchange_rate FROM res_exchange_rates WHERE currency_code = ? ORDER BY rate_date DESC LIMIT 1`,
      [currency]
    );

    // If no exchange rate is found, return an error
    if (exchangeRateResult.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid currency or exchange rate not found" });
    }

    const exchangeRate = exchangeRateResult[0].exchange_rate;

    // Convert the subtotal from base currency to the requested currency
    let subTotalAmount = subTotal * exchangeRate;
    let total = subTotalAmount;

    // Initialize discount values
    let totalDiscountValue = 0;
    let totalDiscountPercent = 0;

    // Apply discount if available
    if (discount.length > 0) {
      const discountAmount = discount[0].amount || 0; // Replace 'amount' with the actual discount field name
      const convertedDiscount = discountAmount * exchangeRate; // Convert discount to requested currency

      // Calculate total after applying the converted discount
      total = total - convertedDiscount > 0 ? total - convertedDiscount : 0;

      // Set discount values for response
      totalDiscountValue = convertedDiscount.toFixed(2);
      totalDiscountPercent = (
        (convertedDiscount / subTotalAmount) * 100
      ).toFixed(2);
    }

    // Fetch all applicable taxes
    const [taxes] = await pool.execute(`SELECT * FROM res_taxes`);

    // Calculate the total tax amount based on the subtotal
    let totalTax = taxes.reduce((acc, tax) => {
      const taxAmount = (subTotalAmount * tax.rate) / 100; // Calculate tax amount based on the converted subtotal
      return acc + taxAmount;
    }, 0);

    // Calculate the total amount after applying tax
    const totalAmountAfterTax = total + totalTax;

    // Prepare the response
    let response = {
      currency: currency,
      discounts: discount,
      subTotal: subTotalAmount.toFixed(2),
      total: total.toFixed(2),
      totalDiscountValue: totalDiscountValue,
      totalDiscountPercent: totalDiscountPercent,
      taxes: taxes.map((tax) => ({
        id: tax.id,
        name: tax.name,
        rate: tax.rate,
        description: tax.description,
      })),
      totalTax: totalTax.toFixed(2),
      totalAmountAfterTax: totalAmountAfterTax.toFixed(2),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { checkDiscount };
