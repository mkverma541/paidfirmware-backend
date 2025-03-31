const { format } = require("date-fns");
const { pool } = require("../../config/database");
const { sendOrderConfirmationEmail } = require("./helper");

const processOrder = async (order_id, user_id) => {
  let connection;
  try {
    // Start transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch user's cart
    const [userCart] = await connection.execute(
      "SELECT * FROM res_cart WHERE user_id = ?",
      [user_id]
    );

    if (!userCart || userCart.length === 0) {
      throw new Error("Cart is empty");
    }

    // Separate file and package items
    const files = userCart.filter((item) => item.item_type === 1);
    const packages = userCart.filter((item) => item.item_type === 2);
    const products = userCart.filter((item) => item.item_type === 3);
    const courses = userCart.filter((item) => item.item_type === 4);

    if (packages.length > 0) {
      const packageIds = packages.map((item) => item.item_id);
      const placeholders = packageIds.map(() => "?").join(", ");

      const [packageDetails] = await connection.execute(
        `SELECT * FROM res_download_packages WHERE package_id IN (${placeholders})`,
        packageIds
      );

      if (packageDetails.length > 0) {
        await connection.execute(
          "UPDATE res_upackages SET is_current = 0 WHERE user_id = ?",
          [user_id]
        );

        const packageInsertions = packageDetails.map((item) => {
          const currentDate = new Date();
          const expireDate = new Date(
            currentDate.getTime() + item.period * 1000
          );
          return [
            item.package_id,
            order_id,
            item.title,
            JSON.stringify(item),
            user_id,
            item.bandwidth,
            item.bandwidth_files,
            item.extra,
            item.extra_files,
            item.fair,
            item.fair_files,
            item.devices,
            "",
            1,
            0,
            0,
            currentDate,
            expireDate,
          ];
        });

        await connection.query(
          `INSERT INTO res_upackages (
            package_id, order_id, package_title, package_object, user_id, 
            bandwidth, bandwidth_files, extra, extra_files, fair, fair_files, 
            devices, devices_fp, is_active, is_current, is_free, date_create, date_expire
          ) VALUES ?`,
          [packageInsertions]
        );
      }
    }

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

    if (courses.length > 0) {
      for (const course of courses) {
        const [rows] = await connection.execute(
          "SELECT * FROM res_courses WHERE course_id = ?",
          [course.item_id]
        );
        const courseDetail = rows[0];
        if (!courseDetail)
          throw new Error(`Course not found: ${course.item_id}`);

        let expiryDate = new Date();
        if (courseDetail.duration_type === 1) {
          switch (courseDetail.duration_unit) {
            case "hours":
              expiryDate.setHours(
                expiryDate.getHours() + courseDetail.duration
              );
              break;
            case "days":
              expiryDate.setDate(expiryDate.getDate() + courseDetail.duration);
              break;
            case "weeks":
              expiryDate.setDate(
                expiryDate.getDate() + courseDetail.duration * 7
              );
              break;
            case "months":
              expiryDate.setMonth(
                expiryDate.getMonth() + courseDetail.duration
              );
              break;
            case "years":
              expiryDate.setFullYear(
                expiryDate.getFullYear() + courseDetail.duration
              );
              break;
            default:
              throw new Error(
                `Unknown duration_unit: ${courseDetail.duration_unit}`
              );
          }
        } else {
          expiryDate = new Date(courseDetail.expiry_date);
        }

        await connection.execute(
          "INSERT INTO res_ucourses (user_id, course_id, order_id, expiry_date, meta) VALUES (?, ?, ?, ?, ?)",
          [
            user_id,
            course.item_id,
            order_id,
            expiryDate,
            JSON.stringify(courseDetail),
          ]
        );
      }
    }

    await connection.execute("DELETE FROM res_cart WHERE user_id = ?", [
      user_id,
    ]);


    await connection.commit();
    sendOrderConfirmationEmail(user_id, order_id);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error processing order:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

const addCreditsBalance = async (order_id) => {
  let connection;
  try {
    // Start transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[order]] = await connection.execute(
      "SELECT * FROM res_orders WHERE order_id = ?",
      [order_id]
    );

    if (!order) {
      throw new Error("Order not found");
    }

    const user_id = order.user_id;
    const amount = order.amount_paid;
    const exchangeRate = order.exchange_rate || 1; // Default to 1 if not provided
    const amountToAdd = parseFloat(amount) / parseFloat(exchangeRate);

    await connection.execute(
      "INSERT INTO res_uwallet_recharge (user_id, order_id, amount) VALUES (?, ?, ?)",
      [user_id, order_id, amountToAdd]
    );

    const [[userWallet]] = await connection.execute(
      "SELECT balance FROM res_users WHERE user_id = ?",
      [user_id]
    );

    const newBalance = parseFloat(userWallet.balance) + amountToAdd;

    await connection.execute(
      "UPDATE res_users SET balance = ? WHERE user_id = ?",
      [newBalance, user_id]
    );

    await connection.execute(
      "INSERT INTO res_transfers (user_id, order_id, amount, type, notes, description) VALUES (?, ?, ?, ?, ?, ?)",
      [
        user_id,
        order_id,
        amountToAdd,
        "credit",
        "Wallet recharge",
        `Wallet recharge #${order_id}`,
      ]
    );

    await connection.commit();
    sendOrderConfirmationEmail(user_id, order_id);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error processing order:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { processOrder, addCreditsBalance };
