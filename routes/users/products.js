const express = require("express");
const router = express.Router();

const ProductController = require("../../controllers/user/products");
const cacheMiddleware = require("../../middlewars/redis");
const checkApiKeyMiddleware = require("../../middlewars/validateApiKey");

router.get(
  "/",
  checkApiKeyMiddleware,
  cacheMiddleware,
  ProductController.getProductList
);
router.get("/:slug", cacheMiddleware, ProductController.getProductDetails);
router.get(
  "/related-products/:slug",
  cacheMiddleware,
  ProductController.getRelatedProducts
);
router.get(
  "/category/:slug",
  cacheMiddleware,
  ProductController.getProductsByCategory
);

module.exports = router;
