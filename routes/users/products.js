const express = require('express');
const router = express.Router();

const { cacheJson } = require('../../middlewars/cacheMiddleware');
const ProductController = require('../../controllers/user/products');

router.get('/', cacheJson, ProductController.getProductList);
router.get('/:slug', cacheJson, ProductController.getProductDetails);
router.get('/related-products/:slug', cacheJson, ProductController.getRelatedProducts);
router.get('/category/:slug', cacheJson, ProductController.getProductsByCategory);


module.exports = router;
