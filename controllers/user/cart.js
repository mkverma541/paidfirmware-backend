const { pool, secretKey } = require("../../config/database");
const crypto = require("crypto");
const { min } = require("date-fns");
const jwt = require("jsonwebtoken");

async function syncCart(req, res) {
  const { id } = req.user;

  try {
    const cartItems = req.body.cartItems || [];
    console.log("cartItems", cartItems);

    if (!Array.isArray(cartItems)) {
      return res.status(400).json({ message: "Invalid cartItems format." });
    }

    if (cartItems.length === 0) {
      return res.status(200).json({
        message: "Cart is empty.",
        cart: [],
      });
    }

    // Fetch user's existing cart items
    const [userCartItems] = await pool.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [id]
    );

    console.log("userCartItems", userCartItems);

    // Prepare update and insert lists
    const itemsToUpdate = [];
    const itemsToInsert = [];
    const existingItemIds = new Set(userCartItems.map((item) => item.item_id));

    cartItems.forEach((item) => {
      if (!item.item_id || !item.item_name || item.sale_price === undefined) {
        console.error("Invalid item detected:", item);
        return;
      }

      if (existingItemIds.has(item.item_id)) {
        itemsToUpdate.push({ ...item, user_id: id });
      } else {
        itemsToInsert.push({ ...item, user_id: id });
      }
    });

    // Update existing cart items
    if (itemsToUpdate.length > 0) {
      for (const item of itemsToUpdate) {
        console.log("Updating item:", item);
        await pool.execute(
          `UPDATE res_cart 
          SET quantity = ?, 
              sale_price = ?, 
              original_price = ?, 
              item_name = ?, 
              stock = ?, 
              meta = ? 
          WHERE user_id = ? 
          AND item_id = ?`,
          [
            item.quantity ?? 1,
            +item.sale_price ?? 0,
            item.original_price !== undefined ? +item.original_price : item.sale_price,
            item.item_name,
            item.stock !== undefined ? +item.stock : null,
            item.meta || null,
            item.user_id,
            item.item_id,
          ]
        );
      }
    }

    // Insert new cart items
    if (itemsToInsert.length > 0) {
      const insertCartQuery = `
        INSERT INTO res_cart 
        (user_id, item_id, item_type, item_name, sale_price, original_price, quantity, stock, media, meta, min_cart_qty, max_cart_qty) 
        VALUES ?
      `;

      const cartValues = itemsToInsert.map((item) => [
        item.user_id,
        item.item_id,
        item.item_type || "default", // Ensure item_type has a default value
        item.item_name,
        +item.sale_price || 0,
        item.original_price !== undefined ? +item.original_price : item.sale_price,
        item.quantity ?? 1,
        item.stock !== undefined ? +item.stock : null,
        item.media || "",
        item.meta || null,
        item.min_cart_qty ?? 1,
        item.max_cart_qty ?? 1,
      ]);

      console.log("Inserting items:", cartValues);
      await pool.query(insertCartQuery, [cartValues]);
    }

    return res.status(200).json({
      message: "Cart synchronized successfully.",
      cart: [...userCartItems, ...itemsToInsert],
    });
  } catch (error) {
    console.error("Error syncing cart:", error);
    res.status(500).json({
      message: "An error occurred while syncing the cart.",
      error: error.message,
    });
  }
}


async function getCart(req, res) {
  try {
    const { id } = req.user; // Extract user ID from the token

    // Fetch the user's cart from the database
    const [cart] = await pool.execute(
      "SELECT * FROM res_cart WHERE user_id = ? AND is_active = 1",
      [id]
    );

    // Return the merged cart
    res.status(200).json({
      message: "Cart retrieved and merged successfully.",
      cart: cart,
    });
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { syncCart, getCart };
