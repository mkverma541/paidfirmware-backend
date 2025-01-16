const express = require('express');
const router = express.Router();

const AttributeController = require('../../controllers/user/productAttributes');
const CategoryController = require('../../controllers/user/productCategories');
const TagController = require('../../controllers/admin/productTags');

const cacheMiddleware = require("../../middlewars/redis");

router.get('/attributes', cacheMiddleware, AttributeController.getAllAttributes);

router.get('/categories', cacheMiddleware, CategoryController.listCategories);
router.get('/categories/:categoryId', cacheMiddleware, CategoryController.getSubcategories)  

router.get("/tags", cacheMiddleware, TagController.getAllTags); // List all tags
router.get("/products/:productId/tags", cacheMiddleware, TagController.getProductTags); // Get tags for a specific product


module.exports = router;
