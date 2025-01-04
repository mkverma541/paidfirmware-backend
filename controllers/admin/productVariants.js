const { pool } = require("../../config/database");

// Add a new product variant
async function addVariant(req, res) {
  const {
    variant_sku,
    variant_name,
    variant_price,
    variant_stock_quantity,
    color,
    size,
    material,
    weight,
    dimensions,
    variant_image_url
  } = req.body;

  try {
    await pool.execute(
      `INSERT INTO res_product_variants (
        variant_id, 
        variant_sku, 
        variant_name, 
        variant_price, 
        variant_stock_quantity, 
        color, 
        size, 
        material, 
        weight, 
        dimensions, 
        variant_image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        variant_id,
        variant_sku,
        variant_name,
        variant_price,
        variant_stock_quantity,
        color,
        size,
        material,
        weight,
        dimensions,
        variant_image_url
      ]
    );

    res.status(201).json({ message: "Variant added successfully" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getProductList(req, res) {
  try {
    // Query all products with the necessary details
    const [products] = await pool.execute(
      `SELECT 
        product_id, product_name, sku, original_price, sale_price, stock_quantity, description, manufacturer, 
        supplier, status, images, tags, is_featured, rating, reviews_count, categories 
      FROM res_products`
    );

    if (products.length === 0) {
      return res.status(404).json({ error: "No products found" });
    }

    // Create an array to hold combined product data
    const productList = [];

    // Loop through each product and fetch its variants and attributes
    for (const product of products) {
      // Fetch variants for each product
      const [variants] = await pool.execute(
        `SELECT 
          variant_id, variant_sku, variant_name, variant_price, variant_stock_quantity, color, size, material, 
          weight, dimensions, variant_image_url 
        FROM res_product_variants WHERE product_id = ?`, 
        [product.product_id]
      );

      // Fetch attributes for each product
      const [attributes] = await pool.execute(
        `SELECT attribute_name, attribute_value FROM res_product_attributes WHERE product_id = ?`, 
        [product.product_id]
      );

      // Combine the product, variants, and attributes
      const combinedProduct = {
        product,
        variants,
        attributes,
      };

      // Add the combined product to the product list
      productList.push(combinedProduct);
    }

    // Return the list of products with their variants and attributes
    res.status(200).json(productList);
  } catch (error) {
    console.error("Error fetching product list:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


module.exports = { addVariant, getProductList };
