const { format, addSeconds } = require("date-fns");
const { pool } = require("../../config/database");
const { getPackagePeriods, sendOrderConfirmationEmail } = require("./helper");

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
    const files = userCart.filter((item) => item.item_type === 1);
    const packages = userCart.filter((item) => item.item_type === 2);
    const products = userCart.filter((item) => item.item_type === 3);
    const walletRecharge = userCart.filter((item) => item.item_type === 5);
    const courses = userCart.filter((item) => item.item_type === 4);

    // Process packages if any
    console.log("packages", packages);
  

    if (packages.length > 0) {
      const packageIds = packages.map((item) => item.item_id);
      const packagePeriods = await getPackagePeriods(packageIds);
    
      // Prepare package insertions
      const packageInsertions = packages.map((item) => {
        const period = packagePeriods.get(item.item_id) || 0;
    
        return [
          item.item_id,                         // package_id
          item.title || "",                      // package_title
          JSON.stringify(item),                  // package_object
          user_id,                               // user_id
          username || "",                        // username
          item.bandwidth || 0,                   // bandwidth
          item.bandwidth_files || 0,             // bandwidth_files
          item.extra || 0,                       // extra
          item.extra_files || 0,                 // extra_files
          item.fair || 0,                        // fair
          item.fair_files || 0,                  // fair_files
          item.devices || 0,                     // devices
          item.devices_fp || 0,                  // devices_fp
          1,                                     // is_active
          0,                                     // is_current
          0,                                     // is_free
          new Date(),                            // date_create
          formatDateForDB(addSeconds(new Date(), period)) // date_expire
        ];
      });
    
      // Deactivate current packages
      await connection.execute(
        "UPDATE res_upackages SET is_current = 0 WHERE user_id = ?",
        [user_id]
      );
    
      if (packageInsertions.length > 0) {
        const query = `
          INSERT INTO res_upackages (
            package_id, package_title, package_object, user_id, username, 
            bandwidth, bandwidth_files, extra, extra_files, fair, fair_files, 
            devices, devices_fp, is_active, is_current, is_free, date_create, date_expire
          ) VALUES ?
        `;
    
        await connection.query(query, [packageInsertions]);
      }
    }
    
    // Insert files if any
    if (files.length > 0) {
      const fileInsertValues = files.map((file) => [
        user_id,
        file.item_id,
        file.sale_price,
        order_id
      ]);
    
      await connection.query(
        "INSERT INTO res_ufiles (user_id, file_id, price, order_id) VALUES ?",
        [fileInsertValues]
      );
    }
    

    console.log("files", files);

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

    const courseInsertValues = await Promise.all(
      courses.map(async (course) => {
        // Fetch course details
        const [rows] = await connection.execute(
          "SELECT * FROM res_courses WHERE course_id = ?",
          [course.item_id]
        );
        const courseDetail = rows[0];

        if (!courseDetail) {
          throw new Error(
            `Course details not found for item_id: ${course.item_id}`
          );
        }

        const { duration_type, duration, duration_unit, expiry_date } =
          courseDetail;

        console.log("courseDetail", courseDetail);

        // Initialize expiryDate as the current date
        let expiryDate = new Date();

        if (duration_type === 1) {
          // Add duration based on the unit
          switch (duration_unit) {
            case "hours":
              expiryDate.setHours(expiryDate.getHours() + duration);
              break;
            case "days":
              expiryDate.setDate(expiryDate.getDate() + duration);
              break;
            case "weeks":
              expiryDate.setDate(expiryDate.getDate() + duration * 7);
              break;
            case "months":
              expiryDate.setMonth(expiryDate.getMonth() + duration);
              break;
            case "years":
              expiryDate.setFullYear(expiryDate.getFullYear() + duration);
              break;
            default:
              throw new Error(`Unknown duration_unit: ${duration_unit}`);
          }
        } else if (duration_type === 2) {
          // Use the expiry_date directly for type 2
          expiryDate = new Date(expiry_date);
          if (isNaN(expiryDate.getTime())) {
            throw new Error(`Invalid expiry_date: ${expiry_date}`);
          }
        } else {
          expiryDate = expiry_date;
        }

        return [
          user_id,
          course.item_id,
          order_id,
          expiryDate,
          JSON.stringify(courseDetail),
        ];
      })
    );

    await connection.query(
      "INSERT INTO res_ucourses (user_id, course_id, order_id, expiry_date, meta) VALUES ?",
      [courseInsertValues]
    );

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

      const newBalance =
        parseFloat(userWallet[0].balance) +
        parseFloat(walletRecharge[0].sale_price);

      await connection.execute(
        "UPDATE res_users SET balance = ? WHERE user_id = ?",
        [newBalance, user_id]
      );

      // Insert wallet transaction

      await connection.execute(
        "INSERT INTO res_transfers (user_id, order_id, amount, type, notes, description) VALUES (?, ?, ?, ?, ?, ?)",
        [
          user_id,
          order_id,
          walletRecharge[0].sale_price,
          "credit",
          "Wallet recharge",
          "Wallet recharge " + "#" + order_id,
        ]
      );
    }

    console.log("processOrder", order_id, user_id);

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
