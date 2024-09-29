const { addSeconds } = require("date-fns");
const { pool } = require("../../config/database");
const { fetchUserCart, getPackagePeriods, sendOrderConfirmationEmail } = require("./helper");

const processOrder = async (user_id, razorpay_payment_id, razorpay_order_id, order, res) => {
  const connection = await pool.getConnection();

  try {
    // Start transaction
    await connection.beginTransaction();

    // Fetch and validate user's cart
    const userCart = await fetchUserCart(user_id);
    if (!userCart.length) {
      await connection.rollback();
      return res.status(400).json({ error: "Cart is empty." });
    }

    // Separate file and package IDs (filtering in one go)
    const fileIds = [];
    const packageIds = [];
    userCart.forEach(item => {
      if (item.file_id) fileIds.push(item.file_id);
      if (item.package_id) packageIds.push(item.package_id);
    });

    // Insert order into `res_orders` table
    const [{ insertId: order_id }] = await connection.execute(
      "INSERT INTO res_orders (transaction_order_id, user_id, payment_id, total, status) VALUES (?, ?, ?, ?, ?)",
      [razorpay_order_id, user_id, razorpay_payment_id, order.amount, "paid"]
    );

    // Handle package-related updates if packages exist
    if (packageIds.length) {
      const periodsMap = await getPackagePeriods(packageIds);

      // Deactivate user's existing packages
      await connection.execute("UPDATE res_upackages SET is_current = 0 WHERE user_id = ?", [user_id]);

      // Batch insert new packages (Promise.all for concurrent inserts)
      const packageInsertions = userCart.map((item, index) => {
        if (!item.package_id || !periodsMap.get(item.package_id)) return null;

        const packagePeriod = periodsMap.get(item.package_id);
        const dateExpire = addSeconds(new Date(), packagePeriod);
        const isCurrent = index === 0 ? 1 : 0; // Set first package as current

        return connection.execute(
          "INSERT INTO res_upackages (user_id, package_id, order_id, is_active, is_current, date_expire) VALUES (?, ?, ?, ?, ?, ?)",
          [user_id, item.package_id, order_id, 1, isCurrent, dateExpire]
        );
      });

      await Promise.all(packageInsertions.filter(Boolean)); // Execute non-null queries
    }

    // Handle file entries insertion (Promise.all for concurrent inserts)
    if (fileIds.length) {
      const fileInsertions = fileIds.map(fileId =>
        connection.execute(
          "INSERT INTO res_ufiles (user_id, file_id, order_id) VALUES (?, ?, ?)",
          [user_id, fileId, order_id]
        )
      );
      await Promise.all(fileInsertions); // Insert all files in parallel
    }

    // Clear user's cart
    await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [user_id]);

    // Commit transaction
    await connection.commit();

    // Send order confirmation email asynchronously (no need to block the response)
    sendOrderConfirmationEmail(user_id, razorpay_order_id, razorpay_payment_id, order.amount);

    // Return only the order ID in the response
    return res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Payment processing error:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

module.exports = { processOrder };
