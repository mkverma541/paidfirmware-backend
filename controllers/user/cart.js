const { pool } = require("../../config/database");

async function syncCart(req, res) {
  try {
    // Extracting cartItems from req.body and id from req.user
    const { cartItems } = req.body; 
    const { id } = req.user; 
    const user_id = id;

    // Check if cartItems is properly defined and is an array
    if (!Array.isArray(cartItems)) {
      return res.status(400).json({ error: "Invalid cart items" });
    }

    // Delete existing items in the cart for the user
    await pool.execute("DELETE FROM res_cart WHERE user_id = ?", [user_id]);

    // Insert each item based on whether it contains file_id or package_id
    for (const item of cartItems) {
      const { package_id, file_id, quantity = 1 } = item;

      if (package_id) {
        // If package_id is provided, insert package_id
        await pool.execute(
          "INSERT INTO res_cart (user_id, package_id, quantity) VALUES (?, ?, ?)",
          [user_id, package_id, quantity]
        );
      } else if (file_id) {
        // If file_id is provided, insert file_id
        await pool.execute(
          "INSERT INTO res_cart (user_id, file_id, quantity) VALUES (?, ?, ?)",
          [user_id, file_id, quantity]
        );
      }
    }

    // Fetch the updated cart after syncing (same logic as in getCart)
    const [updatedCartItems] = await pool.execute(
      `SELECT c.package_id, c.file_id, c.quantity, p.*, f.*
         FROM res_cart c
         LEFT JOIN res_download_packages p ON c.package_id = p.package_id
         LEFT JOIN res_files f ON c.file_id = f.file_id
         WHERE c.user_id = ?`,
      [user_id]
    );

    // Return the updated cart as a response
    res.status(200).json({ message: "Cart synchronized successfully", cartItems: updatedCartItems });
  } catch (error) {
    console.error("Error syncing cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getCart(req, res) {
  const { id } = req.user;

  try {
    // Fetch all cart items along with package and file details
    const [cartItems] = await pool.execute(
      `SELECT c.package_id, c.file_id, c.quantity, p.*, f.*
         FROM res_cart c
         LEFT JOIN res_download_packages p ON c.package_id = p.package_id
         LEFT JOIN res_files f ON c.file_id = f.file_id
         WHERE c.user_id = ?`,
      [id]
    );

    res.status(200).json({ cartItems });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { syncCart, getCart };
