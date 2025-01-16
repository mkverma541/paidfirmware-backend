const { pool, secretKey } = require("../../config/database");
const { insertOrder, calculateOrderDetails } = require("./helper");

const { processOrder } = require("./processOrder");

async function createOrder(req, res) {
  try {
    const {id} = req.user;
    const user_id = id;
    const options = req.body;
    // get cart items

    const [cartItems] = await pool.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [user_id]
    );

    if (!cartItems.length) {

      return res.status(400).json({
        status: "fail",
        message: "No items in cart.",
      });

    }

    // calculate order details

    const orderDetails = await calculateOrderDetails({
      cartItems,
      discountCode: options.discount_code,
      currency: options.currency,
    });


    const itemTypes = [...new Set(cartItems.map((item) => item.item_type))];
    
    // Insert the order

    let payload = {
      user_id: user_id,
      transaction_order_id: null,
      ...options,
      item_types: JSON.stringify(itemTypes),
      ...orderDetails,
    };

    const order = await insertOrder(payload);

    // Respond with order details and full user information
    return res.json({
      order_id: order,
    });

  } catch (err) {
    console.error("Error creating order:", err.message);
    res.status(500).send({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

async function confirmOrder(req, res) {
  const { id } = req.user;
  const { order_id } = req.body;

  try {
    const [order] = await pool.execute(
      "SELECT * FROM res_orders WHERE order_id = ? AND user_id = ?",
      [order_id, id]
    );

    if (!order.length) {
      return res.status(404).json({
        status: "fail",
        message: "Order not found.",
      });
    }
 
    await processOrder(order_id, id);

    return res.json({
      status: "success",
      message: "Order confirmed successfully.",
    });
  } catch (err) {
    console.error("Error confirming order:", err.message);
    res.status(500).send({
      status: "error",
      message: "Internal Server Error",
    });
  }
}

module.exports = { createOrder, confirmOrder };
