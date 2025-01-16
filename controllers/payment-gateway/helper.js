const { pool } = require("../../config/database");

const { sendEmail } = require("../service/emailer");

// Fetch and validate user cart
const fetchUserCart = async (userId) => {
  const [userCart] = await pool.execute(
    "SELECT *  FROM res_cart WHERE user_id = ?",
    [userId]
  );
  return userCart;
};

// Insert order into the database

const insertOrder = async (d) => {
  console.log(d, "data");

  // Ensure all required fields have default values
  const {
    user_id,
    transaction_order_id = null,
    subtotal = 0,
    total_amount = 0,
    amount_due = 0,
    tax = 0,
    discount = 0,
    exchange_rate = 1,
    payment_method,
    currency,
    notes = null,
    item_types = '[]', // Default as empty JSON string if not provided
  } = d;

  if (
    !user_id ||
    !payment_method ||
    !currency ||
    !item_types
  ) {
    throw new Error("Missing required fields");
  }

  try {
    const [order] = await pool.execute(
      `INSERT INTO res_orders 
      (user_id, transaction_order_id, subtotal, total_amount, amount_due, tax, discount, exchange_rate, payment_method, currency, notes, item_types) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        transaction_order_id,
        subtotal,
        total_amount,
        amount_due,
        tax,
        discount,
        exchange_rate,
        payment_method,
        currency,
        notes,
        item_types,
      ]
    );
    console.log(order);
    return order.insertId;
  } catch (error) {
    console.error("Error inserting order:", error.message);
    throw error;
  }
};

const calculateOrderDetails = async ({ cartItems, discountCode, currency }) => {
  try {
    if (!cartItems.length) {
      throw new Error("Cart is empty.");
    }

    const [exchangeRateResult] = await pool.execute(
      `SELECT exchange_rate FROM res_exchange_rates WHERE currency_code = ? ORDER BY rate_date DESC LIMIT 1`,
      [currency]
    );

    if (exchangeRateResult.length === 0) {
      throw new Error(`Exchange rate not found for currency: ${currency}`);
    }

    const exchange_rate = exchangeRateResult[0].exchange_rate;
    console.log(exchange_rate, "exchange_rate");

    // Calculate subtotal in base currency (USD)
    const subtotal = cartItems.reduce((acc, item) => {
      const price = item.sale_price || 0;
      const quantity = item.quantity || 1;
      return acc + price * quantity;
    }, 0);

    // Convert subtotal to target currency
    const subtotal_converted = subtotal * exchange_rate;

    // Apply discount
    let discount_value = 0;
    if (discountCode) {
      const [discountResult] = await pool.execute(
        `SELECT * FROM res_coupons WHERE code = ? AND is_active = 1`,
        [discountCode]
      );

      if (discountResult.length > 0) {
        const discount = discountResult[0];
        const discount_amount = parseFloat(discount.discount_value) || 0;

        if (discount.discount_type === "fixed") {
          discount_value = Math.min(
            discount_amount * exchange_rate,
            subtotal_converted
          );
        } else if (discount.discount_type === "percentage") {
          discount_value = subtotal_converted * (discount_amount / 100);
        }
      }
    }

    const total_after_discount = subtotal_converted - discount_value;

    // Calculate taxes
    const [taxes] = await pool.execute(`SELECT * FROM res_tax_classes`);
    const total_tax = taxes.reduce((acc, tax) => {
      if (tax.amount_type === "percent") {
        return acc + (total_after_discount * parseFloat(tax.amount)) / 100;
      } else if (tax.amount_type === "fixed") {
        return acc + parseFloat(tax.amount) * exchange_rate;
      }
      return acc;
    }, 0);

    // Calculate final total and due amount
    const total_amount = total_after_discount + total_tax;

    // Return all calculated values as an object
    return {
      currency,
      exchange_rate,
      subtotal: parseFloat(subtotal_converted),
      discount: parseFloat(discount_value),
      tax: parseFloat(total_tax),
      total_amount: parseFloat(total_amount),
      amount_due: parseFloat(total_amount), // Assuming no payment initially
    };
  } catch (error) {
    throw new Error(`Error calculating order details: ${error.message}`);
  }
};

const getPackagePeriods = async (packageIds) => {
  const placeholders = packageIds.map(() => "?").join(",");
  const [periods] = await pool.execute(
    `SELECT package_id, period FROM res_download_packages WHERE package_id IN (${placeholders})`,
    packageIds
  );
  console.log(periods);
  return new Map(periods.map((p) => [p.package_id, p.period])); // Map for quick lookup
};

// create user if not present token

const createNewUser = async (user) => {
  // check if user already exists find by email

  const [existingUser] = await pool.execute(
    "SELECT * FROM res_users WHERE email = ?",
    [user.email]
  );

  if (existingUser.length > 0) {
    return existingUser[0].user_id;
  }

  // if not find create unique username and random password

  const username = user.email.split("@")[0] + Math.floor(Math.random() * 1000);
  const password = Math.random().toString(36).slice(-8);

  const [newUser] = await pool.execute(
    "INSERT INTO res_users (username, email, phone, password) VALUES (?, ?, ?, ?)",
    [username, user.email, user.phone, password]
  );

  return newUser.insertId;
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (userId, paymentId, orderId) => {
  try {
    const [user] = await pool.execute(
      "SELECT email FROM res_users WHERE user_id = ?",
      [userId]
    );
    
    if (!user || user.length === 0) {
      throw new Error("User not found.");
    }

    const userEmail = user[0].email || "mkverma541@gmail.com"; // Fallback to default email if none is present

    if (!userEmail) {
      throw new Error(
        "No email address found for the user, and no fallback email provided."
      );
    }

    const emailSubject = "Order Confirmation";
    const emailBody = `
      Hi,<br><br>
      Your order has been confirmed.<br><br>
      Order ID: ${orderId}<br>
      Payment ID: ${paymentId}<br>
      Thank you for your purchase.
    `;

    await sendEmail(userEmail, emailSubject, emailBody);
    console.log(`Order confirmation email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error in sendOrderConfirmationEmail:", error.message);
    // Optionally, you could log the error or notify your team through a monitoring service
  }
};

module.exports = {
  fetchUserCart,
  getPackagePeriods,
  insertOrder,
  sendOrderConfirmationEmail,
  createNewUser,
  calculateOrderDetails,
};
