const { pool, secretKey } = require("../../config/database");
const jwt = require("jsonwebtoken");

async function checkDiscount(req, res) {
  try {
    let userId = null;
    const { discount_code, currency, cartHashId } = req.body;
    let discount = [];
    let cartItems = [];

    // Extract user ID from token if provided
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, secretKey);
        userId = decoded.id;
      } catch (err) {
        console.error("Invalid token:", err.message);
      }
    }

    if (userId) {
      // Fetch cart items for the logged-in user
      const [userCartItems] = await pool.execute(
        `SELECT * FROM res_cart WHERE user_id = ?`,
        [userId]
      );

      cartItems = userCartItems;
    } else if (cartHashId) {
      // Fetch guest cart items
      const [guestCartItems] = await pool.execute(
        `SELECT * FROM res_cart WHERE cart_hash = ?`,
        [cartHashId]
      );
      cartItems = guestCartItems;
    }

    if (cartItems.length === 0) {
      return res.status(200).json({
        message: "Cart is empty",
        currency,
        discounts: [],
        subTotal: 0,
        taxes: [],
        total: 0,
      });
    }

    // check if currency code is valid

    const [currencyResult] = await pool.execute(
      `SELECT * FROM res_currencies WHERE currency_code = ?`,
      [currency]
    );

    if (currencyResult.length === 0) {
      return res.status(400).json({ message: "Invalid currency code" });
    }

    // Calculate the subtotal price of the cart

    let subTotal = cartItems.reduce((acc, item) => {
      const price = item.sale_price || 0;
      const quantity = item.quantity || 1;
      return acc + price * quantity;
    }, 0);

    // get the conversion rate for the currency

    const [conversionRate] = await pool.execute(
      `SELECT currency_code, rate FROM res_currencies WHERE currency_code = ? `,
      [currency]
    );

    if (conversionRate.length === 0) {
      return res.status(400).json({ message: "Invalid currency code" });
    }

    const exchangeRateResult = parseFloat(conversionRate[0].rate);
    console.log("Exchange Rate:", exchangeRateResult);

    const subTotalAmount = subTotal * exchangeRateResult;
    let total = subTotalAmount;

    // Initialize discount values
    let totalDiscountValue = 0;

    // Apply discount if available
    if (discount_code) {
      const [discountResult] = await pool.execute(
        `SELECT * FROM res_coupons WHERE code = ? AND is_active = 1`,
        [discount_code]
      );
      discount = discountResult;

      if (discount.length > 0) {
        const discountAmount = parseFloat(discount[0].discount_value) || 0;
        const discountType = discount[0].discount_type;

        if (discountType === "fixed") {
          const convertedDiscountAmount = discountAmount * exchangeRateResult;
          totalDiscountValue = parseFloat(convertedDiscountAmount);
        } else if (discountType === "percentage") {
          totalDiscountValue = parseFloat(
            subTotalAmount * (discountAmount / 100)
          );
        }

        total -= parseFloat(totalDiscountValue);
      }
    }

    // Fetch all applicable taxes
    const [taxes] = await pool.execute(`SELECT * FROM res_tax_classes`);

    // Calculate the total tax amount based on the subtotal
    let totalTax = taxes.reduce((acc, tax) => {
      let taxAmount = 0;
      if (tax.amount_type === "percent") {
        taxAmount = (subTotalAmount * parseFloat(tax.amount)) / 100;
      } else if (tax.amount_type === "fixed") {
        taxAmount = parseFloat(tax.amount) * exchangeRateResult;
      }
      return acc + taxAmount;
    }, 0);

    // Calculate the total amount after applying tax
    const totalAmountAfterTax = total + totalTax;

    // Prepare the response
    let response = {
      currency,
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
        total_discount: totalDiscountValue, 
      })),
      subTotal: subTotalAmount,
      taxes: taxes.map((tax) => {
        let taxAmount = 0;
        if (tax.amount_type === "percent") {
          taxAmount = (subTotalAmount * parseFloat(tax.amount)) / 100;
        } else if (tax.amount_type === "fixed") {
          taxAmount = parseFloat(tax.amount) * exchangeRateResult; 
        }
        return {
          id: tax.class_id,
          title: tax.title,
          rate: tax.amount,
          amount_type: tax.amount_type,
          description: tax.description,
          totalAmount: taxAmount,
        };
      }),
      total: totalAmountAfterTax,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({
      error: "Internal Server Error",
      cart: [],
    });
  }
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
    if (
      currentDate < new Date(coupon.start_date) ||
      currentDate > new Date(coupon.end_date)
    ) {
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
    const subtotal = cartItems.reduce(
      (acc, item) => acc + (item.price || 0) * (item.quantity || 1),
      0
    );

    // Check minimum order value
    if (subtotal < coupon.min_order_value) {
      return res.status(400).json({
        message: `Minimum order value for this discount code is ${coupon.min_order_value}`,
      });
    }

    // Check product type restrictions
    if (coupon.product_type) {
      const validProduct = cartItems.some(
        (item) => item.product_type === coupon.product_type
      );
      if (!validProduct) {
        return res.status(400).json({
          message: `Discount code is not valid for the products in your cart`,
        });
      }
    }

    // Check usage limits
    if (coupon.usage_count >= coupon.max_usage) {
      return res.status(400).json({
        message: "Discount code usage limit has been reached",
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
