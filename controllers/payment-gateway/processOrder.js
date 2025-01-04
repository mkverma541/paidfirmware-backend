const { format, addSeconds } = require("date-fns");
const { pool } = require("../../config/database");
const {
  fetchUserCart,
  updatePaymentStatus,
  getPackagePeriods,
  sendOrderConfirmationEmail,
} = require("./helper");

const formatDateForDB = (date) => format(date, "yyyy-MM-dd HH:mm:ss");

const processOrder = async (data) => {
  const connection = await pool.getConnection();

  console.log("data", data);
  const {user_id, order_id, payment_id} = data;

  console.log("Processing order for user:", user_id);

  try {
    // Start transaction
    await connection.beginTransaction();

    // Fetch user's cart
    const userCart = await fetchUserCart(user_id);

    if (!userCart || userCart.length === 0) {
      throw new Error("Cart is empty");
    }

    // Update payment reference
    await updatePaymentStatus(data);
    console.log("Payment updated successfully for order:", order_id);

    // Separate file and package items
    const fileIds = userCart.filter((item) => item.item_type === 1).map((item) => item.item_id);
    const packages = userCart.filter((item) => item.item_type === 2);
    const products = userCart.filter((item) => item.item_type === 3);
    const walletRecharge = userCart.filter((item) => item.item_type === 5); 

    console.log("walletRecharge", walletRecharge)

    // Process packages if any
    if (packages.length > 0) {
      const packageIds = packages.map((item) => item.item_id);
      const packagePeriods = await getPackagePeriods(packageIds);

      const packageInsertions = packages.map((item) => ({
        user_id,
        packageId: item.item_id,
        order_id,
        dateExpire: formatDateForDB(addSeconds(new Date(), packagePeriods.get(item.item_id) || 0)),
        isActive: 1,
        isCurrent: 0,
      }));

      // Deactivate current packages
      await connection.execute("UPDATE res_upackages SET is_current = 0 WHERE user_id = ?", [user_id]);

      // Batch insert packages
      const packageInsertValues = packageInsertions.map(
        (pkg) => [pkg.user_id, pkg.packageId, pkg.orderId, pkg.isActive, pkg.isCurrent, pkg.dateExpire]
      );
      await connection.query(
        "INSERT INTO res_upackages (user_id, package_id, order_id, is_active, is_current, date_expire) VALUES ?",
        [packageInsertValues]
      );
      console.log("Packages inserted successfully for user:", user_id);
    }

    // Insert files if any
    if (fileIds.length > 0) {
      const fileInsertValues = fileIds.map((fileId) => [user_id, fileId, order_id]);
      await connection.query(
        "INSERT INTO res_ufiles (user_id, file_id, order_id) VALUES ?",
        [fileInsertValues]
      );
      console.log("Files inserted successfully for user:", user_id);
    }

    // process products

    if(products.length > 0)   {
      const productInsertValues = products.map((product) => [user_id, product.item_id, order_id, product.quantity, product.meta]);
      await connection.query(
        "INSERT INTO res_uproducts (user_id, product_id, order_id, quantity, meta) VALUES ?",
        [productInsertValues]
      );
      console.log("Products inserted successfully for user:", user_id);
    }

    // process wallet recharge
    console.log(walletRecharge, "Wallet recharge")
    
    if(walletRecharge.length > 0)   {
      const walletRechargeInsertValues = walletRecharge.map((recharge) => [user_id, order_id, recharge.sale_price, recharge.meta]);
      await connection.query(
        "INSERT INTO res_uwallet_recharge (user_id, order_id, amount, meta) VALUES ?",
        [walletRechargeInsertValues]
      );
      console.log("Wallet recharge inserted successfully for user:", user_id);
    }

    console.log("Order processed successfully for user:", user_id);
    // Clear user's cart
    await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [user_id]);
    console.log("Cart cleared for user:", user_id);

    // Commit transaction
    await connection.commit();
    console.log("Transaction committed successfully for user:", user_id);

    // Send order confirmation email asynchronously
    sendOrderConfirmationEmail(user_id, payment_id, order_id);
    console.log("Order confirmation email sent to user:", user_id);
  } catch (error) {
    console.error("Error during order processing for user:", user_id, "Error:", error.message);
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release(); // Release the connection
    console.log("Database connection released for user:", user_id);
  }
};

module.exports = { processOrder };
