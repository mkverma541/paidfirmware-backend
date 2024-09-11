const { pool } = require("../config/database");
const jwt = require("jsonwebtoken");
const { secretKey } = require("../config/database"); // Ensure you have secretKey defined

async function syncCart(req, res) {
  const { cartItems } = req.body;

  // Extract user_id from token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Authorization header missing or invalid" });
  }

  const token = authHeader.split(" ")[1];
  let user_id;

  try {
    const decoded = jwt.verify(token, secretKey);
    user_id = decoded.id;
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (!user_id) {
    return res.status(400).json({ error: "Invalid user" });
  }

  let connection;

  try {
    // Get a connection from the pool
    connection = await pool.getConnection();

    // Start the transaction
    await connection.beginTransaction();
    console.log(cartItems);
    console.log(user_id);

    if (Array.isArray(cartItems)) {
      if (cartItems.length === 0) {
        // If cartItems is empty, delete all items from the cart for the user
        await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [
          user_id,
        ]);
      } else {
        // If cartItems is not empty, first delete all existing items
        await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [
          user_id,
        ]);

        // Insert new items with quantity set to 1
        for (const item of cartItems) {
          const { package_id } = item;

          // Insert only package_id with quantity set to 1
          await connection.execute(
            "INSERT INTO res_cart (user_id, package_id, quantity) VALUES (?, ?, ?)",
            [user_id, package_id, 1]
          );
        }
      }
    }

    // Commit the transaction after all queries succeed
    await connection.commit();
    res.status(200).json({ message: "Cart synchronized successfully" });
  } catch (error) {
    // If an error occurs, roll back the transaction
    if (connection) await connection.rollback();
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    // Release the connection back to the pool
    if (connection) connection.release();
  }
}

async function getCart(req, res) {
  // Extract user_id from token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Authorization header missing or invalid" });
  }

  const token = authHeader.split(" ")[1];
  let user_id;

  try {
    const decoded = jwt.verify(token, secretKey);
    user_id = decoded.id;
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (!user_id) {
    return res.status(400).json({ error: "Invalid user" });
  }

  let connection;

  try {
    // Get a connection from the pool
    connection = await pool.getConnection();

    // Fetch all cart items along with package details
    const [cartItems] = await connection.execute(
      `SELECT c.package_id, c.quantity, p.*
         FROM res_cart c
         JOIN res_download_packages p ON c.package_id = p.package_id
         WHERE c.user_id = ?`,
      [user_id]
    );

    // Return the cart items with package details
    res.status(200).json({ cartItems });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    // Release the connection back to the pool
    if (connection) connection.release();
  }
}

module.exports = { syncCart, getCart };
