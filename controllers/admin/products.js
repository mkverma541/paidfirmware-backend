const { pool } = require("../../config/database");

async function addProduct(req, res) {
  const {
    product_name,
    sku = null,
    slug,
    original_price,
    sale_price = null,
    stock_quantity = null,
    short_description = null,
    description = null,
    manufacturer = null,
    supplier = null,
    status = 1,
    media = [],
    categories = [],
    tags = [],
    newCategories = [],
    newTags = [],
    variants,
    attributes,
    fields = [],
  } = req.body;

  // Validate required fields
  if (!product_name || !original_price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  const categoriesIds = categories.map((c) => c.category_id);
  const tagsIds = tags.map((t) => t.tag_id);

  try {
    const [result] = await connection.execute(
      `INSERT INTO res_products (
        product_name, sku, slug, original_price, sale_price, stock_quantity, short_description, description, manufacturer, supplier, 
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_name,
        sku,
        slug,
        original_price,
        sale_price,
        stock_quantity,
        short_description,
        description,
        manufacturer,
        supplier,
        status,
      ]
    );

    const productId = result.insertId;

    // Insert new categories and generate slugs
    if (newCategories.length > 0) {
      for (const categoryName of newCategories) {
        const slug = categoryName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
          .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

        const [insertedCategory] = await connection.execute(
          `INSERT INTO res_product_categories (category_name, slug) VALUES (?, ?)`,
          [categoryName, slug]
        );
        categories.push(insertedCategory.insertId);
      }
    }

    // Insert category relationships
    if (categoriesIds.length > 0) {
      const categoryQueries = categoriesIds.map((categoryId) =>
        connection.execute(
          `INSERT INTO res_product_category_relationship (product_id, category_id) VALUES (?, ?)`,
          [productId, categoryId]
        )
      );
      await Promise.all(categoryQueries);
    }

    // Insert new tags and generate slugs
    if (newTags.length > 0) {
      for (const tagName of newTags) {
        const slug = tagName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
          .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

        const [insertedTag] = await connection.execute(
          `INSERT INTO res_product_tags (tag_name, slug) VALUES (?, ?)`,
          [tagName, slug]
        );
        tags.push(insertedTag.insertId);
      }
    }

    // Insert tag relationships
    if (tagsIds.length > 0) {
      const tagQueries = tagsIds.map((tagId) =>
        connection.execute(
          `INSERT INTO res_product_tag_relationship (product_id, tag_id) VALUES (?, ?)`,
          [productId, tagId]
        )
      );
      await Promise.all(tagQueries);
    }

    // Insert media, variants, attributes, and fields (as in your original code)
    if (media.length > 0) {
      const mediaQueries = media.map((mediaItem) =>
        connection.execute(
          `INSERT INTO res_product_media (product_id, type, file_name, is_cover) VALUES (?, ?, ?, ?)`,
          [productId, mediaItem.type, mediaItem.file_name, mediaItem.is_cover]
        )
      );
      await Promise.all(mediaQueries);
    }

    if (variants && variants.length > 0) {
      const variantQueries = variants.map((variant) =>
        connection.execute(
          `INSERT INTO res_product_variants (
            product_id, variant_sku, variant_name, variant_price, variant_stock_quantity, color, size, material,
            weight, dimensions, variant_image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            variant.variant_sku,
            variant.variant_name,
            variant.variant_price,
            variant.variant_stock_quantity,
            variant.color,
            variant.size,
            variant.material,
            variant.weight,
            variant.dimensions,
            variant.variant_image_url,
          ]
        )
      );
      await Promise.all(variantQueries);
    }

    if (attributes && attributes.length > 0) {
      const attributeQueries = attributes.map((attribute) =>
        connection.execute(
          `INSERT INTO res_product_attribute_relationship (product_id, attribute_id, value_id)
           VALUES (?, ?, ?)`,
          [productId, attribute.attribute_id, attribute.value_id]
        )
      );
      await Promise.all(attributeQueries);
    }

    if (fields && fields.length > 0) {
      const fieldQueries = fields.map((field) =>
        connection.execute(
          `INSERT INTO res_product_fields (product_id, field_name, field_type, is_required) VALUES (?, ?, ?, ?)`,
          [productId, field.field_name, field.field_type, field.is_required]
        )
      );
      await Promise.all(fieldQueries);
    }

    await connection.commit();
    res.status(201).json({
      message: "Product added successfully",
      productId,
    });
  } catch (error) {
    console.error("Database error:", error);
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
}

async function updateProduct(req, res) {
  const { productId } = req.params;
  const product_id = parseInt(productId, 10);

  if (!productId) {
    return res.status(400).json({ error: "Product ID is required" });
  }

  const {
    product_name,
    sku,
    slug,
    original_price,
    sale_price = null,
    stock_quantity,
    description = null,
    manufacturer = null,
    supplier = null,
    status,
    media = [],
    tags = [],
    newTags = [],
    is_featured = 0,
    rating = 0,
    reviews_count = 0,
    categories = [],
    newCategories = [],
    variants,
    attributes,
    fields = [],
  } = req.body;

  // Validate required fields
  if (!product_name || !original_price || !stock_quantity || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  const categoriesIds = categories.map((c) => c.category_id);
  const tagsIds = tags.map((t) => t.tag_id);

  try {
    // Update product information
    await connection.execute(
      `UPDATE res_products SET
        product_name = ?, sku = ?, slug = ?, original_price = ?, sale_price = ?, stock_quantity = ?, description = ?, 
        manufacturer = ?, supplier = ?, status = ?, is_featured = ?, rating = ?, reviews_count = ? 
        WHERE product_id = ?`,
      [
        product_name,
        sku,
        slug,
        original_price,
        sale_price,
        stock_quantity,
        description,
        manufacturer,
        supplier,
        status,
        is_featured,
        rating,
        reviews_count,
        product_id,
      ]
    );

    // Handle media
    if (media.length > 0) {
      await connection.execute(
        `DELETE FROM res_product_media WHERE product_id = ?`,
        [product_id]
      );
      const mediaQueries = media.map((mediaItem) =>
        connection.execute(
          `INSERT INTO res_product_media (product_id, type, file_name, is_cover) VALUES (?, ?, ?, ?)`,
          [product_id, mediaItem.type, mediaItem.file_name, mediaItem.is_cover]
        )
      );
      await Promise.all(mediaQueries);
    }

    // Insert new categories and generate slugs
    if (newCategories.length > 0) {
      for (const categoryName of newCategories) {
        const slug = categoryName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
          .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

        const [insertedCategory] = await connection.execute(
          `INSERT INTO res_product_categories (category_name, slug) VALUES (?, ?)`,
          [categoryName, slug]
        );
        categoriesIds.push(insertedCategory.insertId);
      }
    }

    // Handle categories
    if (categoriesIds.length > 0) {
      await connection.execute(
        `DELETE FROM res_product_category_relationship WHERE product_id = ?`,
        [product_id]
      );
      const categoryQueries = categoriesIds.map((categoryId) =>
        connection.execute(
          `INSERT INTO res_product_category_relationship (product_id, category_id) VALUES (?, ?)`,
          [product_id, categoryId]
        )
      );
      await Promise.all(categoryQueries);
    }

    // Insert new tags and generate slugs
    if (newTags.length > 0) {
      for (const tagName of newTags) {
        const slug = tagName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
          .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

        const [insertedTag] = await connection.execute(
          `INSERT INTO res_product_tags (tag_name, slug) VALUES (?, ?)`,
          [tagName, slug]
        );
        tagsIds.push(insertedTag.insertId);
      }
    }

    // Handle tags
    if (tagsIds.length > 0) {
      await connection.execute(
        `DELETE FROM res_product_tag_relationship WHERE product_id = ?`,
        [product_id]
      );
      const tagQueries = tagsIds.map((tagId) =>
        connection.execute(
          `INSERT INTO res_product_tag_relationship (product_id, tag_id) VALUES (?, ?)`,
          [product_id, tagId]
        )
      );
      await Promise.all(tagQueries);
    }

    // Handle variants
    if (variants && variants.length > 0) {
      await connection.execute(
        `DELETE FROM res_product_variants WHERE product_id = ?`,
        [product_id]
      );
      const variantQueries = variants.map((variant) =>
        connection.execute(
          `INSERT INTO res_product_variants (
            product_id, variant_sku, variant_name, variant_price, variant_stock_quantity, color, size, material,
            weight, dimensions, variant_image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product_id,
            variant.variant_sku,
            variant.variant_name,
            variant.variant_price,
            variant.variant_stock_quantity,
            variant.color,
            variant.size,
            variant.material,
            variant.weight,
            variant.dimensions,
            variant.variant_image_url,
          ]
        )
      );
      await Promise.all(variantQueries);
    }

    // Handle attributes
    if (attributes && attributes.length > 0) {
      await connection.execute(
        `DELETE FROM res_product_attribute_relationship WHERE product_id = ?`,
        [product_id]
      );
      const attributeQueries = attributes.map((attribute) =>
        connection.execute(
          `INSERT INTO res_product_attribute_relationship (product_id, attribute_id, value_id)
           VALUES (?, ?, ?)`,
          [product_id, attribute.attribute_id, attribute.value_id]
        )
      );
      await Promise.all(attributeQueries);
    }

    // Handle custom fields
    if (fields && fields.length > 0) {
      await connection.execute(
        `DELETE FROM res_product_fields WHERE product_id = ?`,
        [product_id]
      );
      const fieldQueries = fields.map((field) =>
        connection.execute(
          `INSERT INTO res_product_fields (product_id, field_name, field_type, is_required) VALUES (?, ?, ?, ?)`,
          [product_id, field.field_name, field.field_type, field.is_required]
        )
      );
      await Promise.all(fieldQueries);
    }

    await connection.commit();
    res.status(200).json({
      message: "Product updated successfully",
      productId: product_id,
    });
  } catch (error) {
    console.error("Database error:", error);
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
}

async function getProductList(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const categorySlug = req.query.category; // Category slug from query params
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Variable to store resolved category_id
    let categoryId = null;

    if (categorySlug) {
      // Fetch category_id based on the provided slug
      const [categoryResult] = await pool.execute(
        `SELECT category_id FROM res_product_categories WHERE slug = ?`,
        [categorySlug]
      );

      if (categoryResult.length === 0) {
        return res.status(404).json({ error: "Invalid category" });
      }

      categoryId = categoryResult[0].category_id;
    }

    // Base query for fetching products
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

    let whereClause = '';
    const queryParams = [limit, offset];

    if (categoryId) {
      baseQuery += `
        JOIN res_product_category_relationship pcr ON p.product_id = pcr.product_id
      `;
      whereClause = `WHERE pcr.category_id = ? `;
      queryParams.unshift(categoryId); // Add category_id as the first query parameter
    }

    baseQuery += ` ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;

    // Query to fetch basic product details
    const [products] = await pool.execute(baseQuery, queryParams);

    if (products.length === 0) {
      return res.status(404).json({ error: "No products found" });
    }

    // Get the total count of products with optional category filtering
    let countQuery = `SELECT COUNT(*) AS total FROM res_products p `;
    if (categoryId) {
      countQuery += `
        JOIN res_product_category_relationship pcr ON p.product_id = pcr.product_id
        WHERE pcr.category_id = ?
      `;
    }

    const [[{ total }]] = await pool.execute(countQuery, categoryId ? [categoryId] : []);

    // Fetch associated media for all products
    const productIds = products.map((p) => p.product_id);

    if (productIds.length === 0) {
      return res.status(200).json({
        current_page: page,
        total_pages: 1,
        total_products: total,
        data: [],
      });
    }

    const [media] = await pool.execute(
      `SELECT 
        media_id, product_id, type, file_name, is_cover, created_at, updated_at
      FROM res_product_media
      WHERE product_id IN (${productIds.join(",")})`
    );

    // Fetch associated categories for all products
    const [categories] = await pool.execute(
      `SELECT 
        c.category_id, c.category_name, pcr.product_id
      FROM res_product_categories c
      JOIN res_product_category_relationship pcr ON c.category_id = pcr.category_id
      WHERE pcr.product_id IN (${productIds.join(",")})`
    );

    const mediaMap = media.reduce((acc, curr) => {
      if (!acc[curr.product_id]) {
        acc[curr.product_id] = [];
      }
      acc[curr.product_id].push(curr);
      return acc;
    }, {});

    const categoriesMap = categories.reduce((acc, curr) => {
      if (!acc[curr.product_id]) {
        acc[curr.product_id] = [];
      }
      acc[curr.product_id].push(curr);
      return acc;
    }, {});

    const productList = products.map((product) => ({
      product_name: product.product_name,
      product_id: product.product_id,
      stock_quantity: product.stock_quantity,
      sku: product.sku,
      status: product.status,
      media: mediaMap[product.product_id] || [],
      categories: categoriesMap[product.product_id] || [],
      sale_price: product.sale_price,
      original_price: product.original_price,
      slug: product.slug,
    }));

    const result = {
      data: productList,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    return res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (error) {
    console.error("Error fetching product list:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getRelatedProducts(req, res) {
  try {
    const { slug } = req.params; // Assuming the product slug is passed as a route parameter

    // Validate slug
    if (!slug) {
      return res.status(400).json({ error: "Product slug is required" });
    }

    // Fetch the product_id associated with the provided slug
    const [productResult] = await pool.execute(
      `SELECT product_id 
       FROM res_products 
       WHERE slug = ?`,
      [slug]
    );

    if (productResult.length === 0) {
      return res.status(404).json({ error: "Invalid product slug" });
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
      return res.status(404).json({ error: "No categories found for the product" });
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
      WHERE pcr.category_id IN (${categoryIds.join(",")}) AND p.product_id != ?
      LIMIT 5`, // Limit the number of related products to 5
      [productId]
    );

    // If no related products are found, return an empty array
    if (relatedProducts.length === 0) {
      return res.status(200).json({
        status: "success",
        related_products: [],
      });
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
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getProductsByCategory(req, res) {
  try {
    const { slug } = req.params; // Get category slug from route parameter

    // Validate slug
    if (!slug) {
      return res.status(400).json({ error: "Category slug is required" });
    }

    // Fetch category ID associated with the slug
    const [categoryResult] = await pool.execute(
      `SELECT category_id FROM res_product_categories WHERE slug = ?`,
      [slug]
    );

    if (categoryResult.length === 0) {
      return res.status(404).json({ error: "Invalid category slug" });
    }

    const categoryId = categoryResult[0].category_id;

    // Fetch products associated with the category ID, limited to 5 products and ordered by date desc
    const [products] = await pool.execute(
      `SELECT p.product_name, p.slug, p.sale_price, p.original_price, p.rating, p.reviews_count, p.product_id 
       FROM res_products p
       JOIN res_product_category_relationship pcr ON p.product_id = pcr.product_id
       WHERE pcr.category_id = ?
       ORDER BY p.created_at DESC
       LIMIT 5`,
      [categoryId]
    );

    // If no products are found, return an empty array
    if (products.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
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
    console.error("Error fetching products by category slug:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


async function getProductDetails(req, res) {
  const slug = req.params.slug;

  if (!slug) {
    return res.status(400).json({ error: "Product slug is required" });
  }

  const connection = await pool.getConnection();

  try {
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
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productRows[0];
    const productId = product.product_id;

    // Fetch associated media
    const [mediaRows] = await connection.execute(
      `SELECT 
        media_id, 
        type, 
        file_name, 
        is_cover
      FROM res_product_media
      WHERE product_id = ?`,
      [productId]
    );

    // Fetch categories
    const [categoryRows] = await connection.execute(
      `SELECT 
        c.category_id, 
        c.category_name
      FROM res_product_category_relationship r
      JOIN res_product_categories c ON r.category_id = c.category_id
      WHERE r.product_id = ?`,
      [productId]
    );

    // Fetch tags
    const [tagRows] = await connection.execute(
      `SELECT 
        t.tag_id, 
        t.tag_name
      FROM res_product_tag_relationship r
      JOIN res_product_tags t ON r.tag_id = t.tag_id
      WHERE r.product_id = ?`,
      [productId]
    );

    // Fetch variants
    const [variantRows] = await connection.execute(
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
    );

    // Fetch attributes
    const [attributeRows] = await connection.execute(
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
    );

    // Fetch custom fields
    const [fieldRows] = await connection.execute(
      `SELECT 
        field_id, 
        field_name, 
        field_type, 
        is_required
      FROM res_product_fields
      WHERE product_id = ?`,
      [productId]
    );

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
    console.error("Database error:", error);

    // Rollback transaction if any error occurs
    await connection.rollback();

    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    // Release the connection
    connection.release();
  }
}

async function getProductDetailsById(req, res) {
  const productId = req.params.id;

  if (!productId) {
    return res.status(400).json({ error: "Product id is required" });
  }

  const connection = await pool.getConnection();

  try {
    // Start transaction
    await connection.beginTransaction();
    console.log("Product ID:", productId);

    // Fetch product details by slug
    const [product] = await connection.execute(
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
      WHERE p.product_id = ?`,
      [productId]
    );

    if (product.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Fetch associated media
    const [mediaRows] = await connection.execute(
      `SELECT 
        media_id, 
        type, 
        file_name, 
        is_cover
      FROM res_product_media
      WHERE product_id = ?`,
      [productId]
    );

    // Fetch categories
    const [categoryRows] = await connection.execute(
      `SELECT 
        c.category_id, 
        c.category_name
      FROM res_product_category_relationship r
      JOIN res_product_categories c ON r.category_id = c.category_id
      WHERE r.product_id = ?`,
      [productId]
    );

    // Fetch tags
    const [tagRows] = await connection.execute(
      `SELECT 
        t.tag_id, 
        t.tag_name
      FROM res_product_tag_relationship r
      JOIN res_product_tags t ON r.tag_id = t.tag_id
      WHERE r.product_id = ?`,
      [productId]
    );

    // Fetch variants
    const [variantRows] = await connection.execute(
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
    );

    // Fetch attributes
    const [attributeRows] = await connection.execute(
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
    );

    // Fetch custom fields
    const [fieldRows] = await connection.execute(
      `SELECT 
        field_id, 
        field_name, 
        field_type, 
        is_required
      FROM res_product_fields
      WHERE product_id = ?`,
      [productId]
    );

    // Commit transaction
    await connection.commit();

    // Build the response object
    const productDetails = {
      ...product[0],
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
    console.error("Database error:", error);

    // Rollback transaction if any error occurs
    await connection.rollback();

    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    // Release the connection
    connection.release();
  }
}

async function deleteProduct(req, res) {
  const { productId } = req.params;
  const product_id = parseInt(productId, 10);

  if (!productId) {
    return res.status(400).json({ error: "Product ID is required" });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // Delete the product
    await connection.execute(`DELETE FROM res_products WHERE product_id = ?`, [
      product_id,
    ]);

    // Delete associated media
    await connection.execute(
      `DELETE FROM res_product_media WHERE product_id = ?`,
      [product_id]
    );

    // Delete associated categories
    await connection.execute(
      `DELETE FROM res_product_category_relationship WHERE product_id = ?`,
      [product_id]
    );

    // Delete associated tags
    await connection.execute(
      `DELETE FROM res_product_tag_relationship WHERE product_id = ?`,
      [product_id]
    );

    // Delete associated variants
    await connection.execute(
      `DELETE FROM res_product_variants WHERE product_id = ?`,
      [product_id]
    );

    // Delete associated attributes
    await connection.execute(
      `DELETE FROM res_product_attribute_relationship WHERE product_id = ?`,
      [product_id]
    );

    // Delete associated fields
    await connection.execute(
      `DELETE FROM res_product_fields WHERE product_id = ?`,
      [product_id]
    );

    await connection.commit();
    res.status(200).json({
      message: "Product deleted successfully",
      productId: product_id,
    });
  } catch (error) {
    console.error("Database error:", error);
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
}

module.exports = {
  addProduct,
  getProductList,
  updateProduct,
  getProductDetails,
  deleteProduct,
  getProductDetailsById,
  getRelatedProducts,
  getProductsByCategory,
};
