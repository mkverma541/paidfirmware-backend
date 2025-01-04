const { pool } = require("../../config/database");

async function getProductList(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const categorySlug = req.query.category || null;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;


    // Attempt to fetch the cached result
    const products = await  fetchProductListFromDatabase(categorySlug, limit, offset, page);

    return res.status(200).json({
      status: "success",
      response: products,
    });
  } catch (error) {
    console.error("Error fetching product list:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * Fetches product data from the database with optional category filtering.
 */

async function fetchProductListFromDatabase(
  categorySlug,
  limit,
  offset,
  page,
) {
  try {
    let categoryId = null;

    // Resolve category_id if categorySlug is provided
    if (categorySlug) {
      const [categoryResult] = await pool.execute(
        `SELECT category_id FROM res_product_categories WHERE slug = ?`,
        [categorySlug]
      );

      if (categoryResult.length === 0) {
        throw new Error("Invalid category");
      }

      categoryId = categoryResult[0].category_id;
    }

    // Prepare base query
    let baseQuery = `
      SELECT 
        p.product_name, 
        p.product_id,
        p.stock_quantity,
        p.sku,
        p.sale_price,
        p.original_price,
        p.supplier,
        p.manufacturer,
        p.status,
        p.slug,
        p.created_at
      FROM res_products p
    `;
    const queryParams = [limit, offset];

    if (categoryId) {
      baseQuery += `
        JOIN res_product_category_relationship pcr ON p.product_id = pcr.product_id
      `;
      baseQuery += `WHERE pcr.category_id = ? `;
      queryParams.unshift(categoryId);
    }

    baseQuery += `ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;

    // Fetch product list
    const [products] = await pool.execute(baseQuery, queryParams);
    if (products.length === 0) {
      return {
        currentPage: page,
        totalPages: 1,
        totalCount: 0,
        data: [],
      };
    }

    // Fetch total product count
    const countQuery = categoryId
      ? `
        SELECT COUNT(*) AS total 
        FROM res_products p
        JOIN res_product_category_relationship pcr ON p.product_id = pcr.product_id
        WHERE pcr.category_id = ?
      `
      : `SELECT COUNT(*) AS total FROM res_products`;
    const [[{ total }]] = await pool.execute(
      countQuery,
      categoryId ? [categoryId] : []
    );

    // Fetch media and categories for the products
    const productIds = products.map((product) => product.product_id);
    const [media] = await pool.execute(
      `SELECT media_id, product_id, type, file_name, is_cover, created_at, updated_at 
       FROM res_product_media WHERE product_id IN (${productIds
         .map(() => "?")
         .join(",")})`,
      productIds
    );
    const [categories] = await pool.execute(
      `SELECT c.category_id, c.category_name, pcr.product_id 
       FROM res_product_categories c 
       JOIN res_product_category_relationship pcr ON c.category_id = pcr.category_id 
       WHERE pcr.product_id IN (${productIds.map(() => "?").join(",")})`,
      productIds
    );

    // Map media and categories
    const mediaMap = media.reduce((acc, item) => {
      if (!acc[item.product_id]) acc[item.product_id] = [];
      acc[item.product_id].push(item);
      return acc;
    }, {});
    const categoriesMap = categories.reduce((acc, item) => {
      if (!acc[item.product_id]) acc[item.product_id] = [];
      acc[item.product_id].push(item);
      return acc;
    }, {});

    // Format the product list
    const productList = products.map((product) => ({
      ...product,
      media: mediaMap[product.product_id] || [],
      categories: categoriesMap[product.product_id] || [],
    }));

    return {
      data: productList,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching data from the database:", error);
    throw error;
  }
}

async function getRelatedProducts(req, res) {
  try {
    const { slug } = req.params; // Assuming the product slug is passed as a route parameter

    // Validate slug
    if (!slug) {
      return res.status(400).json({ error: "Product slug is required" });
    }

    const [productResult] = await pool.execute(
      `SELECT product_id 
         FROM res_products 
         WHERE slug = ?`,
      [slug]
    );

    if (productResult.length === 0) {
      return { error: "Invalid product slug" };
    }

    const productId = productResult[0].product_id;

    // Fetch categories associated with the resolved product_id
    const [categories] = await pool.execute(
      `SELECT category_id 
         FROM res_product_category_relationship 
         WHERE product_id = ?`,
      [productId]
    );

    if (categories.length === 0) {
      return { error: "No categories found for the product" };
    }

    const categoryIds = categories.map((cat) => cat.category_id);

    // Fetch related products in the same categories, excluding the current product
    const [relatedProducts] = await pool.execute(
      `SELECT DISTINCT 
          p.product_name, 
          p.slug, 
          p.sale_price, 
          p.original_price, 
          p.rating, 
          p.reviews_count, 
          p.product_id 
        FROM res_products p
        JOIN res_product_category_relationship pcr ON p.product_id = pcr.product_id
        WHERE pcr.category_id IN (${categoryIds.join(
          ","
        )}) AND p.product_id != ?
        LIMIT 5`, // Limit the number of related products to 5
      [productId]
    );

    // If no related products are found, return an empty array
    if (relatedProducts.length === 0) {
      return {
        status: "success",
        related_products: [],
      };
    }

    // Fetch the cover image for the related products
    const relatedProductIds = relatedProducts.map((p) => p.product_id);

    const [media] = await pool.execute(
      `SELECT 
          product_id, file_name
        FROM res_product_media 
        WHERE is_cover = 1 AND product_id IN (${relatedProductIds.join(",")})`
    );

    // Map media to products
    const mediaMap = media.reduce((acc, curr) => {
      acc[curr.product_id] = curr.file_name;
      return acc;
    }, {});

    // Construct the response
    const result = relatedProducts.map((product) => ({
      product_name: product.product_name,
      slug: product.slug,
      image: mediaMap[product.product_id] || null,
      sale_price: product.sale_price,
      original_price: product.original_price,
      rating: product.rating,
      reviews_count: product.reviews_count,
    }));

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching related products:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getProductsByCategory(req, res) {
  try {
    const { slug } = req.params; // Get category slug from route parameter

    // Validate slug
    if (!slug) {
      return res.status(400).json({ error: "Category slug is required" });
    }

    const [categoryResult] = await pool.execute(
      `SELECT category_id FROM res_product_categories WHERE slug = ?`,
      [slug]
    );

    if (categoryResult.length === 0) {
      return { error: "Invalid category slug" };
    }

    const categoryId = categoryResult[0].category_id;

    // Fetch products associated with the category ID, limited to 5 products and ordered by date desc
    const [products] = await pool.execute(
      `SELECT p.product_name, p.slug, p.sale_price, p.original_price, p.rating, p.reviews_count, p.product_id 
         FROM res_products p
         JOIN res_product_category_relationship pcr ON p.product_id = pcr.product_id
         WHERE pcr.category_id = ?
         ORDER BY p.created_at DESC
         `,
      [categoryId]
    );

    // If no products are found, return an empty array
    if (products.length === 0) {
      return {
        status: "success",
        data: [],
      };
    }

    // Fetch the cover image for the products
    const productIds = products.map((p) => p.product_id);

    const [media] = await pool.execute(
      `SELECT 
          product_id, file_name
         FROM res_product_media 
         WHERE is_cover = 1 AND product_id IN (${productIds.join(",")})`
    );

    // Map media to products
    const mediaMap = media.reduce((acc, curr) => {
      acc[curr.product_id] = curr.file_name;
      return acc;
    }, {});

    // Construct the response
    const result = products.map((product) => ({
      product_name: product.product_name,
      slug: product.slug,
      image: mediaMap[product.product_id] || null,
      sale_price: product.sale_price,
      original_price: product.original_price,
      rating: product.rating,
      reviews_count: product.reviews_count,
    }));

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getProductDetails(req, res) {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ error: "Product slug is required" });
  }

  let connection;
  try {
    connection = await pool.getConnection(); // Get connection from the pool

    // Start transaction
    await connection.beginTransaction();

    // Fetch product details by slug
    const [productRows] = await connection.execute(
      `SELECT 
        p.product_id, 
        p.product_name, 
        p.sku, 
        p.slug, 
        p.original_price, 
        p.sale_price, 
        p.stock_quantity,
        p.short_description, 
        p.description, 
        p.manufacturer, 
        p.supplier, 
        p.status, 
        p.is_featured, 
        p.rating, 
        p.reviews_count
      FROM res_products p
      WHERE p.slug = ?`,
      [slug]
    );

    if (productRows.length === 0) {
      // Rollback transaction if product is not found
      await connection.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productRows[0];
    const productId = product.product_id;

    // Fetch associated media, categories, tags, variants, attributes, and custom fields concurrently
    const [
      [mediaRows],
      [categoryRows],
      [tagRows],
      [variantRows],
      [attributeRows],
      [fieldRows],
    ] = await Promise.all([
      connection.execute(
        `SELECT 
          media_id, 
          type, 
          file_name, 
          is_cover
        FROM res_product_media
        WHERE product_id = ?`,
        [productId]
      ),
      connection.execute(
        `SELECT 
          c.category_id, 
          c.category_name
        FROM res_product_category_relationship r
        JOIN res_product_categories c ON r.category_id = c.category_id
        WHERE r.product_id = ?`,
        [productId]
      ),
      connection.execute(
        `SELECT 
          t.tag_id, 
          t.tag_name
        FROM res_product_tag_relationship r
        JOIN res_product_tags t ON r.tag_id = t.tag_id
        WHERE r.product_id = ?`,
        [productId]
      ),
      connection.execute(
        `SELECT 
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
        FROM res_product_variants
        WHERE product_id = ?`,
        [productId]
      ),
      connection.execute(
        `SELECT 
          ar.product_id, 
          a.name, 
          a.slug,
          v.name AS value
        FROM res_product_attribute_relationship ar
        JOIN res_product_attributes a ON ar.id = a.id
        JOIN res_product_attribute_values v ON ar.value_id = v.id
        WHERE ar.product_id = ?`,
        [productId]
      ),
      connection.execute(
        `SELECT 
          field_id, 
          field_name, 
          field_type, 
          is_required
        FROM res_product_fields
        WHERE product_id = ?`,
        [productId]
      ),
    ]);

    // Commit transaction
    await connection.commit();

    // Build the response object
    const productDetails = {
      ...product,
      media: mediaRows,
      categories: categoryRows,
      tags: tagRows,
      variants: variantRows,
      attributes: attributeRows,
      fields: fieldRows,
    };

    res.status(200).json({
      message: "Product details fetched successfully",
      data: productDetails,
    });
  } catch (error) {
    console.error("Error fetching product details:", error);

    if (connection) {
      await connection.rollback(); // Rollback transaction on error
    }

    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (connection) {
      connection.release(); // Always release connection back to the pool
    }
  }
}

module.exports = {
  getProductList,
  getProductDetails,
  getRelatedProducts,
  getProductsByCategory,
};
