const express = require('express');
const router = express.Router();

const TagsController = require('../../controllers/admin/blogs/tags');
const CategoriesController = require('../../controllers/admin/blogs/categories');
const BlogsController = require('../../controllers/admin/blogs/blogs');


// Blog routes
router.post('/create', BlogsController.createBlog);
router.get('/', BlogsController.getBlogs);
router.delete('/delete/:id', BlogsController.deleteBlog);


// Tag routes
router.post('/tags/create', TagsController.createTag);
router.get('/tags', TagsController.getTags);
router.delete('/tags/delete/:id', TagsController.deleteTag);

// Category routes
router.post('/categories/create', CategoriesController.createCategory);
router.get('/categories', CategoriesController.getCategories);
router.delete('/categories/delete/:id', CategoriesController.deleteCategory);


module.exports = router;
