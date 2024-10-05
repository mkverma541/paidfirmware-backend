const { pool } = require("../../config/database");

// Get all blogs with status 'published' and featured = 1 (without tags)
async function getBlogs(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
        b.likes,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE b.status = 'published' AND b.featured = 0
      GROUP BY b.blog_id
      ORDER BY b.created_at DESC
    `);

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

// Get featured blogs
async function getFeaturedBlog(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
          b.likes,
        b.featured_image,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE b.featured = 1
      GROUP BY b.blog_id
    `);

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

async function getRecentBlogs(req, res) {
  const { limit = 5 } = req.query;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
          b.likes,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE b.status = 'published'
      GROUP BY b.blog_id
      ORDER BY b.created_at DESC
      LIMIT ?
    `,
      [limit]
    );

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

async function getBlog(req, res) {
  const { slug } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
          b.likes,
        b.content,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE b.slug = ?
      GROUP BY b.blog_id
    `,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Blog not found",
        status: "error",
      });
    }

    const blog = rows.map(
      ({ categories, ...blog }) =>
        ({
          ...blog,
          categories: categories ? categories.split(",") : [], // Convert categories string to array
        }[0])
    );

    res.status(200).json({
      data: blog,
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

async function getBlogTags(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT tag_id, name
      FROM res_blogs_tags
    `);

    res.status(200).json({
      data: rows,
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

async function getBlogCategories(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT category_id, name
      FROM res_blogs_categories
    `);

    res.status(200).json({
      data: rows,
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

async function getBlogByTag(req, res) {
  const { tag } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      LEFT JOIN res_blogs_tags_relationship bt ON b.blog_id = bt.blog_id
      LEFT JOIN res_blogs_tags t ON bt.tag_id = t.tag_id
      WHERE t.name = ?
      GROUP BY b.blog_id
    `,
      [tag]
    );

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

async function getBlogByCategory(req, res) {
  const { category } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE c.name = ?
      GROUP BY b.blog_id
    `,
      [category]
    );

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

// get top blogs by views

async function getTopBlogsByViews(req, res) {
  const { limit = 5 } = req.query;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE b.status = 'published'
      GROUP BY b.blog_id
      ORDER BY b.views DESC
      LIMIT ?
    `,
      [limit]
    );

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

async function searchBlogs(req, res) {
  const { query } = req.query;

  // Check if the query parameter is provided
  if (!query) {
    return res.status(400).json({
      message: "Query parameter is required",
      status: "error",
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE b.title LIKE ? OR b.author LIKE ? OR b.excerpt LIKE ?
      GROUP BY b.blog_id
    `,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

async function likeBlog(req, res) {
  const { blog_id } = req.body;

  try {
    const [rows] = await pool.query(
      `
      UPDATE res_blogs
      SET likes = likes + 1
      WHERE blog_id = ?
    `,
      [blog_id]
    );

    res.status(200).json({
      message: "Blog liked successfully",
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

async function unlikeBlog(req, res) {
  const { blog_id } = req.body;

  try {
    const [rows] = await pool.query(
      `
      UPDATE res_blogs
      SET likes = likes - 1
      WHERE blog_id = ?
    `,
      [blog_id]
    );

    res.status(200).json({
      message: "Blog unliked successfully",
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

async function commentOnBlog(req, res) {
  const { blog_id, user_id, comment } = req.body;

  try {
    const [rows] = await pool.query(
      `
      INSERT INTO res_blog_comments (blog_id, user_id, comment)
      VALUES (?, ?, ?)
    `,
      [blog_id, user_id, comment]
    );

    res.status(200).json({
      message: "Comment added successfully",
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

async function replyToComment(req, res) {
  const { comment_id, user_id, reply } = req.body;

  try {
    const [rows] = await pool.query(
      `
      INSERT INTO res_blog_comment_replies (comment_id, user_id, reply)
      VALUES (?, ?, ?)
    `,
      [comment_id, user_id, reply]
    );

    res.status(200).json({
      message: "Reply added successfully",
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

// get blog comments with reply, user details

async function getBlogComments(req, res) {
  const { blog_id } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        bc.comment_id,
        bc.comment,
        bc.created_at,
        u.fullname,
        u.photo as avatar,
        GROUP_CONCAT(DISTINCT bcr.reply) AS replies
      FROM res_blog_comments bc
      LEFT JOIN res_users u ON bc.user_id = u.user_id
      LEFT JOIN res_blog_comment_replies bcr ON bc.comment_id = bcr.comment_id
      WHERE bc.blog_id = ?
      GROUP BY bc.comment_id
    `,
      [blog_id]
    );

    // Directly format the results into the desired structure
    const comments = rows.map(({ replies, ...comment }) => ({
      ...comment,
      replies: replies ? replies.split(",") : [], // Convert replies string to array
    }));

    res.status(200).json({
      data: comments,
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

async function getRelatedBlogs(req, res) {
  const { blog_id } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.blog_id,
        b.title,
        b.slug,
        b.author,
        b.excerpt,
        b.featured_image,
        b.created_at,
        GROUP_CONCAT(DISTINCT c.name) AS categories
      FROM res_blogs b
      LEFT JOIN res_blogs_categories_relationship bc ON b.blog_id = bc.blog_id
      LEFT JOIN res_blogs_categories c ON bc.category_id = c.category_id
      WHERE b.blog_id != ?
      GROUP BY b.blog_id
      ORDER BY b.created_at DESC
      LIMIT 3
    `,
      [blog_id]
    );

    // Directly format the results into the desired structure
    const blogs = rows.map(({ categories, ...blog }) => ({
      ...blog,
      categories: categories ? categories.split(",") : [], // Convert categories string to array
    }));

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

module.exports = {
  getBlogs,
  getFeaturedBlog,
  getRecentBlogs,
  getBlog,
  getBlogTags,
  getBlogCategories,
  getBlogByTag,
  getBlogByCategory,
  getTopBlogsByViews,
  searchBlogs,
  likeBlog,
  unlikeBlog,
  commentOnBlog,
  replyToComment,
  getBlogComments,
  getRelatedBlogs,
};
