const { format, addSeconds } = require("date-fns");
const { pool } = require("../../config/database");
const {
  fetchUserCart,
  getPackagePeriods,
  sendOrderConfirmationEmail,
} = require("./helper");

const formatDateForDB = (date) => format(date, "yyyy-MM-dd HH:mm:ss");

const processOrder = async (order_id, user_id) => {
  try {
    // Start transaction
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Fetch user's cart
    const [userCart] = await pool.execute(
      "SELECT *  FROM res_cart WHERE user_id = ?",
      [user_id]
    );

    if (!userCart || userCart.length === 0) {
      throw new Error("Cart is empty");
    }

    // Separate file and package items
    const files = userCart
      .filter((item) => item.item_type === 1);
    const packages = userCart.filter((item) => item.item_type === 2);
    const products = userCart.filter((item) => item.item_type === 3);
    const walletRecharge = userCart.filter((item) => item.item_type === 5);

    // Process packages if any
    if (packages.length > 0) {
      const packageIds = packages.map((item) => item.item_id);
      const packagePeriods = await getPackagePeriods(packageIds);

      const packageInsertions = packages.map((item) => ({
        user_id,
        packageId: item.item_id,
        order_id,
        dateExpire: formatDateForDB(
          addSeconds(new Date(), packagePeriods.get(item.item_id) || 0)
        ),
        isActive: 1,
        isCurrent: 0,
      }));

      // Deactivate current packages
      await connection.execute(
        "UPDATE res_upackages SET is_current = 0 WHERE user_id = ?",
        [user_id]
      );

      // Batch insert packages
      const packageInsertValues = packageInsertions.map((pkg) => [
        pkg.user_id,
        pkg.packageId,
        pkg.orderId,
        pkg.isActive,
        pkg.isCurrent,
        pkg.dateExpire,
      ]);
      await connection.query(
        "INSERT INTO res_upackages (user_id, package_id, order_id, is_active, is_current, date_expire) VALUES ?",
        [packageInsertValues]
      );
    }

    console.log("Files:", files);

    // Insert files if any
    if (files.length > 0) {
      const fileInsertValues = files.map((file) => [
        user_id,
        file.item_id,
        file.sale_price,
        order_id,
      ]);
      await connection.query(
        "INSERT INTO res_ufiles (user_id, file_id, price, order_id) VALUES ?",
        [fileInsertValues]
      );
    }

    // process products

    if (products.length > 0) {
      const productInsertValues = products.map((product) => [
        user_id,
        product.item_id,
        order_id,
        product.quantity,
        product.meta,
      ]);
      await connection.query(
        "INSERT INTO res_uproducts (user_id, product_id, order_id, quantity, meta) VALUES ?",
        [productInsertValues]
      );
    }

    // process wallet recharge
    console.log(walletRecharge, "Wallet recharge");

    if (walletRecharge.length > 0) {
      const walletRechargeInsertValues = walletRecharge.map((recharge) => [
        user_id,
        order_id,
        recharge.sale_price,
        recharge.meta,
      ]);
      await connection.query(
        "INSERT INTO res_uwallet_recharge (user_id, order_id, amount, meta) VALUES ?",
        [walletRechargeInsertValues]
      );

      // Update user's wallet balance

      const [userWallet] = await connection.execute(
        "SELECT * FROM res_users WHERE user_id = ?",
        [user_id]
      );

      if (userWallet.length === 0) {
        throw new Error("User not found");
      }
      console.log("User wallet:", userWallet);
      console.log("Wallet recharge:", walletRecharge);

      const newBalance =
        parseFloat(userWallet[0].balance) + parseFloat(walletRecharge[0].sale_price);

      await connection.execute(
        "UPDATE res_users SET balance = ? WHERE user_id = ?",
        [newBalance, user_id]
      );

      console.log("Wallet updated");

      // Insert wallet transaction

      await connection.execute(
        "INSERT INTO res_transfers (user_id, order_id, amount, type, notes, description) VALUES (?, ?, ?, ?, ?, ?)",
        [
          user_id,
          order_id,
          walletRecharge[0].sale_price,
          'credit',
          "Wallet recharge",
          "Wallet recharge " + "#" + order_id,
        ]
      );

      console.log("Wallet transaction inserted");
    }

    await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [
      user_id,
    ]);

    // Commit transaction
    await connection.commit();

    // Send order confirmation email asynchronously
    sendOrderConfirmationEmail(user_id, order_id);
  } catch (error) {
    console.error(
      "Error during order processing for user:",
      user_id,
      "Error:",
      error.message
    );
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release(); // Release the connection
    console.log("Database connection released for user:", user_id);
  }
};

module.exports = { processOrder };
