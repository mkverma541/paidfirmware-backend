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
            featuredImage, 
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
            title, content, author, slug, excerpt, featuredImage, galleryJson, status, featured
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



// Get all blogs
async function getBlogs(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT b.*, 
                   GROUP_CONCAT(DISTINCT t.name) AS tags, 
                   GROUP_CONCAT(DISTINCT c.name) AS categories
            FROM res_blogs b
            LEFT JOIN res_blogs_tags_relationship bt ON b.blog_id = bt.blog_id
            LEFT JOIN res_blogs_tags t ON bt.tag_id = t.tag_id
            LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
            LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
            GROUP BY b.blog_id
        `);

        // Format the results into the desired structure
        const blogs = rows.map(blog => {
            return {
                blog_id: blog.blog_id,
                title: blog.title,
                slug: blog.slug,
                content: blog.content,
                author: blog.author,
                excerpt: blog.excerpt,
                featured_image: blog.featured_image,
                gallery: blog.gallery ? JSON.parse(blog.gallery) : [], // Parse gallery JSON into array
                status: blog.status,
                created_at: blog.created_at,
                updated_at: blog.updated_at,
                tags: blog.tags ? blog.tags.split(',') : [], // Convert tags string to array
                categories: blog.categories ? blog.categories.split(',') : [], // Convert categories string to array
            };
        });

        res.status(200).json({
            data: blogs,
            status: "success",
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

module.exports = { createBlog, getBlogs, deleteBlog };
