const express = require('express');
const router = express.Router();

const ProductController = require('../../controllers/admin/products');

router.get('/', ProductController.getProductList);
router.get('/:slug', ProductController.getProductDetails);
router.get('/related-products/:slug', ProductController.getRelatedProducts);
router.get('/category/:slug', ProductController.getProductsByCategory);


module.exports = router;
