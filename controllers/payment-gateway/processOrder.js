const { addSeconds } = require("date-fns");
const { pool } = require("../../config/database");
const {
  fetchUserCart,
  updatePaymentStatus,
  getPackagePeriods,
  sendOrderConfirmationEmail,
} = require("./helper");

const processOrder = async (userId, orderId, paymentId) => {
  const connection = await pool.getConnection();

  try {
    // Start transaction
    await connection.beginTransaction();

    // Fetch user's cart and validate it in one query
    const userCart = await fetchUserCart(userId);
    
    if (!userCart.length) {
      console.error("Cart is empty for user:", userId);
      return; // Exit early, no need to respond
    }

    // Update payment reference
    await updatePaymentStatus(paymentId, orderId);

    // Separate file and package IDs
    const fileIds = [];
    const packageIds = [];
    const packageInsertions = [];

    userCart.forEach((item) => {
      if (item.file_id) fileIds.push(item.file_id);
      if (item.package_id) {
        packageIds.push(item.package_id);
        const packagePeriod = item.package_id; // Example: Adjust if needed
        const dateExpire = addSeconds(new Date(), packagePeriod);
        packageInsertions.push({
          userId,
          packageId: item.package_id,
          orderId,
          dateExpire,
          isActive: 1,
          isCurrent: packageInsertions.length === 0 ? 1 : 0,
        });
      }
    });

    // Update packages and deactivate current ones if needed
    if (packageIds.length) {
      await connection.execute(
        "UPDATE res_upackages SET is_current = 0 WHERE user_id = ?",
        [userId]
      );

      const insertPromises = packageInsertions.map(
        ({ userId, packageId, orderId, dateExpire, isActive, isCurrent }) =>
          connection.execute(
            "INSERT INTO res_upackages (user_id, package_id, order_id, is_active, is_current, date_expire) VALUES (?, ?, ?, ?, ?, ?)",
            [userId, packageId, orderId, isActive, isCurrent, dateExpire]
          )
      );

      await Promise.all(insertPromises);
    }

    // Batch insert file entries if there are any
    if (fileIds.length) {
      const fileInsertions = fileIds.map((fileId) =>
        connection.execute(
          "INSERT INTO res_ufiles (user_id, file_id, order_id) VALUES (?, ?, ?)",
          [userId, fileId, orderId]
        )
      );
      await Promise.all(fileInsertions);
    }

    // Clear user's cart
    await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [
      userId,
    ]);

    // Commit transaction
    await connection.commit();

    // Send order confirmation email asynchronously
    sendOrderConfirmationEmail(userId, paymentId, orderId);

    console.log("Payment processed successfully for user:", userId);
  } catch (error) {
    await connection.rollback();
    console.error("Payment processing error:", error.message);
  } finally {
    connection.release();
  }
};

module.exports = {processOrder}