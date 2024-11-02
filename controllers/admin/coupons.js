const { pool } = require("../../config/database");

async function addCoupon(req, res) {
    try {
        const { code, description, discount_value, discount_type, start_date, end_date, min_order_value, product_type, max_usage } = req.body;

        const [result] = await pool.execute(
            `INSERT INTO res_coupons (code, description, discount_value, discount_type, start_date, end_date, min_order_value, product_type, max_usage) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, description, discount_value, discount_type, start_date, end_date, min_order_value, product_type, max_usage]
        );

        return res.status(201).json({ message: "Coupon added successfully", couponId: result.insertId });
    } catch (error) {
        console.error("Error adding coupon:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

async function getCoupons(req, res) {
    try {
        const [coupons] = await pool.execute(`SELECT * FROM res_coupons`);

        return res.status(200).json({ coupons });
    } catch (error) {
        console.error("Error fetching coupons:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

async function updateCoupon(req, res) {
    try {
        const { id } = req.params; // Assume coupon_id is passed as a route parameter
        const { code, description, discount_value, discount_type, start_date, end_date, min_order_value, product_type, max_usage, is_active } = req.body;

        const [result] = await pool.execute(
            `UPDATE res_coupons 
            SET code = ?, description = ?, discount_value = ?, discount_type = ?, start_date = ?, end_date = ?, 
                min_order_value = ?, product_type = ?, max_usage = ?, is_active = ? 
            WHERE coupon_id = ?`,
            [code, description, discount_value, discount_type, start_date, end_date, min_order_value, product_type, max_usage, is_active, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Coupon not found" });
        }

        return res.status(200).json({ message: "Coupon updated successfully" });
    } catch (error) {
        console.error("Error updating coupon:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

module.exports = { addCoupon, getCoupons, updateCoupon };
