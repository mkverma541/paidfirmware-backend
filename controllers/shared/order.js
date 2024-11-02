const { pool } = require("../../config/database");

async function checkDiscount(req, res) {
  try {
    const { id } = req.user;
    const { discount_code, currency } = req.body;
    let discount = [];

    // Check for discount code and retrieve discount details if provided
    if (discount_code) {
      const [discountResult] = await pool.execute(
        `SELECT * FROM res_coupons WHERE code = ? AND is_active = 1`,
        [discount_code]
      );
      discount = discountResult;
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

    // Calculate the subtotal price of the cart in USD (base currency)
    let subTotal = cartItems.reduce((acc, item) => {
      const price = item.price || 0; // Price should be in USD
      const quantity = item.quantity || 1;
      return acc + price * quantity;
    }, 0);

    console.log("Subtotal in base currency (USD):", subTotal);

    // Fetch the exchange rate for the provided currency
    const exchangeRateResult = await getExchangeRate(currency);

    const subTotalAmount = subTotal * exchangeRateResult; // Convert subtotal to target currency
    let total = subTotalAmount;

    console.log("Subtotal in target currency (after conversion):", subTotalAmount);

    // Initialize discount values
    let totalDiscountValue = 0;

    // Apply discount if available
    if (discount.length > 0) {
      const discountAmount = parseFloat(discount[0].discount_value) || 0; // Discount amount in USD
      const discountType = discount[0].discount_type;

      console.log("Discount Amount (in USD):", discountAmount);
      console.log("Discount Type:", discountType);

      // Handle fixed discount conversion from USD to target currency
      if (discountType === "fixed") {
        const convertedDiscountAmount = discountAmount * exchangeRateResult; // Convert the discount to the target currency
        console.log("Converted Discount Amount (in target currency):", convertedDiscountAmount);
        totalDiscountValue = Math.min(convertedDiscountAmount, total).toFixed(2); // Cap discount to total
      } else if (discountType === "percentage") {
        totalDiscountValue = (subTotalAmount * (discountAmount / 100)).toFixed(2);
      }

      total -= parseFloat(totalDiscountValue); // Apply the discount to total
    }

    console.log("Total Discount Applied:", totalDiscountValue);
    console.log("Total after Discount:", total);

    // Fetch all applicable taxes
    const [taxes] = await pool.execute(`SELECT * FROM res_tax_classes`);

    // Calculate the total tax amount based on the subtotal
    let totalTax = taxes.reduce((acc, tax) => {
      let taxAmount = 0;
      if (tax.amount_type === "percent") {
        taxAmount = (subTotalAmount * parseFloat(tax.amount)) / 100;
      } else if (tax.amount_type === "fixed") {
        taxAmount = parseFloat(tax.amount) * exchangeRateResult; // Apply fixed tax in target currency
      }
      return acc + taxAmount;
    }, 0);

    // Calculate the total amount after applying tax
    const totalAmountAfterTax = total + totalTax;

    // Prepare the response
    let response = {
      currency: currency,
      discounts: discount.map((d) => ({
        coupon_id: d.coupon_id,
        code: d.code,
        description: d.description,
        discount_value: d.discount_value,
        discount_type: d.discount_type,
        start_date: d.start_date,
        end_date: d.end_date,
        min_order_value: d.min_order_value,
        product_type: d.product_type,
        max_usage: d.max_usage,
        usage_count: d.usage_count,
        created_at: d.created_at,
        updated_at: d.updated_at,
        is_active: d.is_active,
        total_discount: totalDiscountValue, // Ensure this reflects the converted value
      })),
      subTotal: subTotalAmount.toFixed(2),
      taxes: taxes.map((tax) => {
        let taxAmount = 0;
        if (tax.amount_type === "percent") {
          taxAmount = (subTotalAmount * parseFloat(tax.amount)) / 100;
        } else if (tax.amount_type === "fixed") {
          taxAmount = parseFloat(tax.amount) * exchangeRateResult; // Use the exchange rate to convert fixed tax
        }
        return {
          id: tax.class_id,
          title: tax.title,
          rate: tax.amount,
          amount_type: tax.amount_type,
          description: tax.description,
          totalAmount: taxAmount.toFixed(2),
        };
      }),
      total: totalAmountAfterTax.toFixed(2), // Ensure total includes tax
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Helper function to get exchange rate for target currency
async function getExchangeRate(currency) {
  const [exchangeRateResult] = await pool.execute(
    `SELECT exchange_rate FROM res_exchange_rates WHERE currency_code = ? ORDER BY rate_date DESC LIMIT 1`,
    [currency]
  );

  console.log("Exchange Rate Result for currency:", currency, exchangeRateResult);

  if (exchangeRateResult.length === 0) {
    throw new Error(`Exchange rate not found for currency: ${currency}`);
  }

  return exchangeRateResult[0].exchange_rate;
}

async function checkDiscountCoupon(req, res) {
  try {
    const { id } = req.user;
    const { discount_code, currency } = req.body;

    if (!discount_code) {
      return res.status(400).json({ message: "No discount code provided" });
    }

    // check if discount code exists

    const [couponResult] = await pool.execute(
      `SELECT * FROM res_coupons WHERE code = ?`,
      [discount_code]
    );

    if (couponResult.length === 0) {
      return res.status(400).json({ message: "Invalid discount code" });
    }

    // check if discount code is active

    const coupon = couponResult[0];

    if (coupon.is_active == 0) {
      return res.status(400).json({ message: "Discount code is not active." });
    }

    // Check if coupon is expired
    const currentDate = new Date();
    if (currentDate < new Date(coupon.start_date) || currentDate > new Date(coupon.end_date)) {
      return res.status(400).json({ message: "Discount code is expired" });
    }

    // Fetch cart items
    const [cartItems] = await pool.execute(
      `SELECT c.package_id, c.file_id, c.quantity, p.*, f.*
       FROM res_cart c
       LEFT JOIN res_download_packages p ON c.package_id = p.package_id
       LEFT JOIN res_files f ON c.file_id = f.file_id
       WHERE c.user_id = ?`,
      [id]
    );

      console.log("Cart Items:", cartItems);
    // Calculate subtotal for validation
    const subtotal = cartItems.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);

    // Check minimum order value
    if (subtotal < coupon.min_order_value) {
      return res.status(400).json({
        message: `Minimum order value for this discount code is ${coupon.min_order_value}`
      });
    }

    // Check product type restrictions
    if (coupon.product_type) {
      const validProduct = cartItems.some(
        item => item.product_type === coupon.product_type
      );
      if (!validProduct) {
        return res.status(400).json({
          message: `Discount code is not valid for the products in your cart`
        });
      }
    }

    // Check usage limits
    if (coupon.usage_count >= coupon.max_usage) {
      return res.status(400).json({
        message: "Discount code usage limit has been reached"
      });
    }

    // If all checks pass, return success
    return res.status(200).json({ message: "Discount code is valid" });

  } catch (error) {
    console.error("Error checking discount:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { checkDiscount, checkDiscountCoupon };
