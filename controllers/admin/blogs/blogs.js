const { pool } = require("../../../config/database");

// Create a new blog post

async function createBlog(req, res) {
    const connection = await pool.getConnection();
    try {
        const { 
            title, 
            content, 
            author, 
            slug, 
            categories = [],   // Categories as an array
            tags = [],         // Tags as an array
            excerpt, 
            featured_image, 
            gallery = [],       // Gallery as an array
            status,
            featured = 0   
        } = req.body;

        // Begin transaction
        await connection.beginTransaction();

        // Insert blog
        const query = `
            INSERT INTO res_blogs (title, content, author, slug, excerpt, featured_image, gallery, status, featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Convert gallery array to JSON string
        const galleryJson = JSON.stringify(gallery);

        const [result] = await connection.query(query, [
            title, content, author, slug, excerpt, featured_image, galleryJson, status, featured
        ]);

        const blogId = result.insertId;

        // Insert tags for the blog if provided
        if (tags.length > 0) {
            const tagQuery = `INSERT INTO res_blogs_tags_relationship (blog_id, tag_id) VALUES ?`;
            const tagData = tags.map(tagId => [blogId, tagId]);
            await connection.query(tagQuery, [tagData]);
        }

        // Insert categories for the blog if provided
        if (categories.length > 0) {
            const categoryQuery = `INSERT INTO res_blogs_categories_relationship (blog_id, category_id) VALUES ?`;
            const categoryData = categories.map(categoryId => [blogId, categoryId]);
            await connection.query(categoryQuery, [categoryData]);
        }

        // Commit transaction
        await connection.commit();

        res.status(201).json({ message: "Blog created successfully", status: "success" });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    } finally {
        connection.release();
    }
}


// Get all blogs with pagination, including tags and categories with IDs
async function getBlogs(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Fetch paginated blogs with tags and categories
        const [rows] = await pool.query(`
            SELECT b.*, 
                   GROUP_CONCAT(DISTINCT CONCAT(t.tag_id, ':', t.name)) AS tags, 
                   GROUP_CONCAT(DISTINCT CONCAT(c.category_id, ':', c.name)) AS categories
            FROM res_blogs b
            LEFT JOIN res_blogs_tags_relationship bt ON b.blog_id = bt.blog_id
            LEFT JOIN res_blogs_tags t ON bt.tag_id = t.tag_id
            LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
            LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
            GROUP BY b.blog_id
            ORDER BY b.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        // Format the results into the desired structure
        const blogs = rows.map(blog => {
            // Parse tags and categories into array of objects with id and name
            const tags = blog.tags
                ? blog.tags.split(',').map(tag => {
                    const [id, name] = tag.split(':');
                    return { id: parseInt(id), name };
                })
                : [];

            const categories = blog.categories
                ? blog.categories.split(',').map(category => {
                    const [id, name] = category.split(':');
                    return { id: parseInt(id), name };
                })
                : [];

            return {
                blog_id: blog.blog_id,
                title: blog.title,
                slug: blog.slug,
                author: blog.author,
                featured_image: blog.featured_image,
                status: blog.status,
                created_at: blog.created_at,
                updated_at: blog.updated_at,
                tags, // Array of tag objects with id and name
                categories, // Array of category objects with id and name
            };
        });

        // Get total count for pagination metadata
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM res_blogs`
        );

        // Construct response with pagination metadata
        const response = {
            data: blogs,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            status: "success",
            message: "Blogs fetched successfully",
        };

        res.status(200).json({ response });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal server error",
            status: "error",
        });
    }
}

// get blog by id

async function getBlogById(req, res) {
    try {
        const { id } = req.params;

        // Fetch the blog details with tags and categories
        const [rows] = await pool.query(`
            SELECT b.*, 
                   GROUP_CONCAT(DISTINCT CONCAT(t.tag_id, ':', t.name)) AS tags, 
                   GROUP_CONCAT(DISTINCT CONCAT(c.category_id, ':', c.name)) AS categories
            FROM res_blogs b
            LEFT JOIN res_blogs_tags_relationship bt ON b.blog_id = bt.blog_id
            LEFT JOIN res_blogs_tags t ON bt.tag_id = t.tag_id
            LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
            LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
            WHERE b.blog_id = ?
            GROUP BY b.blog_id
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Blog not found",
                status: "error",
            });
        }

        const blog = rows[0];

        // Parse tags and categories into array of objects with id and name
        const tags = blog.tags
            ? blog.tags.split(',').map(tag => {
                const [tagId, tagName] = tag.split(':');
                return { id: parseInt(tagId), name: tagName };
            })
            : [];

        const categories = blog.categories
            ? blog.categories.split(',').map(category => {
                const [categoryId, categoryName] = category.split(':');
                return { id: parseInt(categoryId), name: categoryName };
            })
            : [];

        // Construct the blog response
        const blogData = {
            blog_id: blog.blog_id,
            title: blog.title,
            slug: blog.slug,
            author: blog.author,
            featured_image: blog.featured_image,
            status: blog.status,
            created_at: blog.created_at,
            updated_at: blog.updated_at,
            tags, // Array of tag objects
            categories, // Array of category objects
        };

        res.status(200).json({
            data: blogData,
            status: "success",
            message: "Blog fetched successfully",
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal server error",
            status: "error",
        });
    }
}

    

// Delete a blog
async function deleteBlog(req, res) {
    try {
        const { id } = req.params;

        const query = `DELETE FROM res_blogs WHERE blog_id = ?`;
        await pool.query(query, [id]);

        res.status(200).json({ message: "Blog deleted successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

module.exports = { createBlog, getBlogs, deleteBlog, getBlogById };
