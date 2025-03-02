const { pool, secretKey } = require("../../config/database");
const crypto = require("crypto");
const { min } = require("date-fns");
const jwt = require("jsonwebtoken");

async function syncCart(req, res) {
  let currentHashId = req.body.hashId || null;

  try {
    const cartItems = req.body.cartItems || [];

    if (!Array.isArray(cartItems)) {
      return res.status(400).json({ message: "Invalid cartItems format." });
    }

    if (cartItems.length === 0) {
      return res.status(200).json({
        message: "Cart is empty.",
        cart: [],
        hashId: currentHashId || null,
      });
    }

    const authHeader = req.headers.authorization;
    let user_id = null;

    if (authHeader) {
      const token = authHeader.split(" ")[1];
      try {
        const decodedUser = jwt.verify(token, secretKey);
        user_id = decodedUser.id;
      } catch (tokenError) {
        return res.status(401).json({ message: "Invalid or expired token." });
      }
    }

    if (user_id) {
      // **Logged-in User**
      if (currentHashId) {
        // Migrate guest cart to user's cart
        const guestCart = await pool.query(
          "SELECT * FROM res_cart WHERE cart_hash = ?",
          [currentHashId]
        );

        if (guestCart[0].length > 0) {
          // Insert guest cart items into the user's cart (avoid duplicates)
          const insertGuestCartQuery = `
            INSERT INTO res_cart (user_id, item_id, item_type, item_name, sale_price, original_price, quantity, stock, media, meta, min_cart_qty, max_cart_qty)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              quantity = VALUES(quantity),
              sale_price = VALUES(sale_price),
              stock = VALUES(stock),
              meta = VALUES(meta)
          `;

          const guestCartValues = guestCart[0].map((item) => [
            user_id,
            item.item_id,
            item.item_type,
            item.item_name,
            item.sale_price,
            item.original_price,
            item.quantity,
            item.stock,
            item.media,
            item.meta,
            item.min_cart_qty || 1,
            item.max_cart_qty || 1
          ]);

          await pool.query(insertGuestCartQuery, [guestCartValues]);

          // Delete guest cart items after migration
          await pool.execute("DELETE FROM res_cart WHERE cart_hash = ?", [
            currentHashId,
          ]);
        }
      }

      // Delete existing cart items for the logged-in user
      await pool.execute("DELETE FROM res_cart WHERE user_id = ?", [user_id]);

      // Insert updated cart items for the user
      const insertUserCartQuery = `
        INSERT INTO res_cart 
        (user_id, item_id, item_type, item_name, sale_price, original_price, quantity, stock, media, meta, min_cart_qty, max_cart_qty) 
        VALUES ?
        ON DUPLICATE KEY UPDATE
          quantity = VALUES(quantity),
          sale_price = VALUES(sale_price),
          stock = VALUES(stock),
          meta = VALUES(meta)
      `;

      const userCartValues = cartItems.map((item) => [
        user_id,
        item.item_id,
        item.item_type,
        item.item_name,
        item.sale_price,
        item.original_price || item.sale_price,
        item.quantity,
        item.stock,
        item.media,
        item.meta,
        item.min_cart_qty || 1,
        item.max_cart_qty || 1
      ]);

      await pool.query(insertUserCartQuery, [userCartValues]);

      // Respond with the synchronized cart for the user
      return res.status(200).json({
        message: "Cart synchronized successfully for user.",
        cart: cartItems,
      });
    } else {
      // **Guest User**
      if (!currentHashId) {
        currentHashId = crypto.randomBytes(16).toString("hex");
      }

      // Delete existing cart items for the hash ID
      await pool.execute("DELETE FROM res_cart WHERE cart_hash = ?", [
        currentHashId,
      ]);

      // Insert new cart items for the guest user
      const insertGuestCartQuery = `
        INSERT INTO res_cart 
        (cart_hash, item_id, item_type, item_name, sale_price, original_price, quantity, stock, media, meta, min_cart_qty, max_cart_qty) 
        VALUES ?
        ON DUPLICATE KEY UPDATE
          quantity = VALUES(quantity),
          sale_price = VALUES(sale_price),
          stock = VALUES(stock),
          meta = VALUES(meta)
      `;

      const guestCartValues = cartItems.map((item) => [
        currentHashId,
        item.item_id,
        item.item_type,
        item.item_name,
        item.sale_price,
        item.original_price || item.sale_price,
        item.quantity,
        item.stock,
        item.media,
        item.meta,
        item.min_cart_qty || 1,
        item.max_cart_qty || 1
      ]);

      await pool.query(insertGuestCartQuery, [guestCartValues]);

      // Respond with updated cart and hash ID
      return res.status(200).json({
        message: "Cart synchronized successfully for guest user.",
        cart: cartItems,
        hashId: currentHashId,
      });
    }
  } catch (error) {
    console.error("Error syncing cart:", error);
    res.status(500).json({
      message: "An error occurred while syncing the cart.",
      error: error.message,
      hashId: currentHashId || null,
    });
  }
}

async function getCart(req, res) {
  try {
    const { id } = req.user; // Extract user ID from the token
    const { hashId } = req.body; // Accept hashId from the request body


    // Fetch the user's cart from the database
    const [userCart] = await pool.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [id]
    );

    // Fetch the cart from the hashId if it exists
    let hashCart = [];
    if (hashId) {
      const [hashCartResult] = await pool.execute(
        "SELECT * FROM res_cart WHERE cart_hash = ?",
        [hashId]
      );
      hashCart = hashCartResult;

      // Update cart_hash items to associate them with the user ID
      await pool.execute(
        "UPDATE res_cart SET user_id = ? WHERE cart_hash = ?",
        [id, hashId]
      );
    }

    // Merge the two carts
    const mergedCart = [...userCart]; // Start with the user's cart
    hashCart.forEach((hashItem) => {
      // Check if the hash item exists in the user's cart
      const itemExists = userCart.some(
        (userItem) => userItem.item_id === hashItem.item_id
      );

      if (!itemExists) {
        mergedCart.push(hashItem); // Add the hash item if not already present
      }
    });

    // Return the merged cart
    res.status(200).json({
      message: "Cart retrieved and merged successfully.",
      cart: mergedCart,
    });
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


module.exports = { syncCart, getCart };
