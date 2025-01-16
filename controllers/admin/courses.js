const { pool } = require("../../config/database");

async function createCourse(req, res) {
  try {
    // Validate and sanitize input

    let {
      title,
      subtitle,
      slug,
      language,
      description,
      sale_price,
      original_price,
      duration_type = 1,
      duration = 1,
      duration_unit = "years",
      expiry_date = null,
      categories = [],
      newCategories = [],
      tags = [],
      newTags = [],
      media = [],
      status = 2,
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    if ((!title, !slug, !original_price, !sale_price)) {
      return res.status(400).json({
        status: "error",
        message: "Please provide title, slug, original_price and sale_price",
      });
    }

    if (sale_price > original_price) {
      return res.status(400).json({
        status: "error",
        message: "Sale price cannot be greater than original price",
      });
    }

    if (expiry_date && new Date(expiry_date) < new Date()) {
      return res.status(400).json({
        status: "error",
        message: "Expiry date cannot be in the past",
      });
    }

    if (duration_type === 1 && duration < 1) {
      return res.status(400).json({
        status: "error",
        message: "Duration value must be greater than 0",
      });
    }

    if (duration_type == 1 && !duration_unit && !duration) {
      return res.status(400).json({
        status: "error",
        message: "Please provide course duration.",
      });
    }

    if (duration_type == 3 && !expiry_date) {
      return res.status(400).json({
        status: "error",
        message: "Please provide expiry date.",
      });
    }

    // check if title and slug already exists

    const [titleExists] = await connection.execute(
      `SELECT * FROM res_courses WHERE title = ?`,
      [title]
    );

    if (titleExists.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Course with this title already exists",
      });
    }

    const [slugExists] = await connection.execute(
      `SELECT * FROM res_courses WHERE slug = ?`,
      [slug]
    );

    if (slugExists.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Course with this slug already exists",
      });
    }

    //now we can insert the course

    // process the string into number
    // if duration_type is 1 then set expiry_date to null
    // if duration_type is 2 then set duration and duration_unit, expiry_date to null
    // if duration_type is 3 then set duration and duration_unit to null

    let duration_value = null;

    if (duration_type == 1) {
      const unitToHours = {
        hours: 1,
        days: 24,
        weeks: 24 * 7,
        months: 24 * 30,
        years: 24 * 365,
      };
      duration_value = (unitToHours[duration_unit] || 0) * duration;
      expiry_date = null;
    } else if (duration_type == 2) {
      duration_value = null;
      expiry_date = null;
    } else if (duration_type == 3) {
      duration_value = null;
      duration = null;
      duration_unit = null;
    }

    // sale_price, original_price, duration_type, duration conver string to number

    sale_price = parseFloat(sale_price);
    original_price = parseFloat(original_price);
    duration_type = parseInt(duration_type);
    duration = parseInt(duration);

    // Insert course data
    const [courseResult] = await connection.query(
      `INSERT INTO res_courses 
      (title, subtitle, slug, language, description, sale_price, original_price, duration_type, duration, duration_unit, expiry_date, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        subtitle,
        slug,
        language,
        description,
        sale_price,
        original_price,
        duration_type,
        duration_value,
        duration_unit,
        expiry_date,
        status,
      ]
    );

    const courseId = courseResult.insertId;

    // Handle categories
    const categoriesIds = [...categories.map((cat) => cat.category_id)];
    for (const categoryName of newCategories) {
      const categorySlug = generateSlug(categoryName);
      const [newCategory] = await connection.execute(
        `INSERT INTO res_course_categories (category_name, slug) VALUES (?, ?)`,
        [categoryName, categorySlug]
      );
      categoriesIds.push(newCategory.insertId);
    }

    if (categoriesIds.length > 0) {
      await Promise.all(
        categoriesIds.map((categoryId) =>
          connection.execute(
            `INSERT INTO res_course_category_relationships (course_id, category_id) VALUES (?, ?)`,
            [courseId, categoryId]
          )
        )
      );
    }

    // Handle tags
    const tagsIds = [...tags.map((tag) => tag.tag_id)];
    for (const tagName of newTags) {
      const tagSlug = generateSlug(tagName);
      const [newTag] = await connection.execute(
        `INSERT INTO res_course_tags (tag_name, slug) VALUES (?, ?)`,
        [tagName, tagSlug]
      );
      tagsIds.push(newTag.insertId);
    }

    if (tagsIds.length > 0) {
      await Promise.all(
        tagsIds.map((tagId) =>
          connection.execute(
            `INSERT INTO res_course_tag_relationship (course_id, tag_id) VALUES (?, ?)`,
            [courseId, tagId]
          )
        )
      );
    }

    // Handle media
    if (media.length > 0) {
      await Promise.all(
        media.map((mediaItem) =>
          connection.execute(
            `INSERT INTO res_course_media (course_id, type, file_name, is_cover) VALUES (?, ?, ?, ?)`,
            [courseId, mediaItem.type, mediaItem.file_name, mediaItem.is_cover]
          )
        )
      );
    }

    await connection.commit();
    res.status(201).json({
      status: "success",
      message: "Course created successfully",
      data: { courseId, title, categories: categoriesIds, tags: tagsIds },
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      status: "error",
      message: error.details ? error.details[0].message : "Invalid input",
    });
  }
}

async function getCourseList(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const categorySlug = req.query.category || null; // Default to null if not provided

    let categoryId = null;

    // Resolve category_id if categorySlug is provided
    if (categorySlug) {
      const [categoryResult] = await pool.execute(
        `SELECT category_id FROM res_course_categories WHERE slug = ?`,
        [categorySlug]
      );

      if (categoryResult.length === 0) {
        return res.status(404).json({ error: "Invalid category" });
      }

      categoryId = categoryResult[0].category_id;
    }

    // Base query
    let baseQuery = `SELECT p.* FROM res_courses p`;
    let whereClause = "";
    const queryParams = [limit, offset];

    if (categoryId) {
      baseQuery += ` 
        JOIN res_course_category_relationships pcr ON p.course_id = pcr.course_id
      `;
      whereClause = `WHERE pcr.category_id = ?`;
      queryParams.unshift(categoryId); // Add category_id to query params
    }

    baseQuery += ` ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;

    // Fetch course details
    const [courses] = await pool.execute(baseQuery, queryParams);

    if (courses.length === 0) {
      return res.status(404).json({ error: "No courses found" });
    }

    // Get total course count
    let countQuery = `SELECT COUNT(*) AS total FROM res_courses p`;
    if (categoryId) {
      countQuery += `
        JOIN res_course_category_relationships pcr ON p.course_id = pcr.course_id
        WHERE pcr.category_id = ?`;
    }

    const [[{ total }]] = await pool.execute(
      countQuery,
      categoryId ? [categoryId] : []
    );

    // Fetch associated media
    const courseIds = courses.map((course) => course.course_id);

    const [media] = await pool.execute(
      `SELECT media_id, course_id, type, file_name, is_cover 
      FROM res_course_media 
      WHERE course_id IN (${courseIds.join(",")}) AND is_cover = 1`
    );

    // Fetch associated categories
    const [categories] = await pool.execute(
      `SELECT c.category_id, c.category_name, pcr.course_id 
      FROM res_course_categories c
      JOIN res_course_category_relationships pcr ON c.category_id = pcr.category_id
      WHERE pcr.course_id IN (${courseIds.join(",")})`
    );

    // Organize media and categories by course ID
    const mediaMap = media.reduce((acc, item) => {
      if (!acc[item.course_id]) {
        acc[item.course_id] = [];
      }
      acc[item.course_id].push(item);
      return acc;
    }, {});

    const categoryMap = categories.reduce((acc, item) => {
      if (!acc[item.course_id]) {
        acc[item.course_id] = [];
      }
      acc[item.course_id].push(item);
      return acc;
    }, {});

    // Structure course data
    const courseList = courses.map((course) => ({
      course_id: course.course_id,
      title: course.title || "Untitled",
      subtitle: course.subtitle || "",
      description: course.description || "",
      language: course.language || "Unknown",
      sale_price: course.sale_price || 0,
      original_price: course.original_price || 0,
      duration_type: course.duration_type || "N/A",
      duration_value: course.duration_value || null,
      expiry_date: course.expiry_date || null,
      created_at: course.created_at || "",
      media: mediaMap[course.course_id] || [],
      categories: categoryMap[course.course_id] || [],
    }));

    // Final response
    return res.status(200).json({
      status: "success",
      data: courseList,
      perPage: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching course list:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


async function  getCourseDetails(req, res) {
  try {
    console.log(req.params);
    const { id, slug } = req.params; // Extracting id or slug from request params
    
    if (!id && !slug) {
      return res.status(400).json({ error: "Course ID or slug is required" });
    }

    let courseQuery = `SELECT * FROM res_courses WHERE`;                                                    
    let queryParams = [];

    // If a course ID is provided, fetch by ID
    if (id) {
      courseQuery += ` course_id = ?`;
      queryParams.push(id);
    } 
    // If a slug is provided, fetch by slug                                   
    else if (slug) {
      courseQuery += ` slug = ?`;
      queryParams.push(slug);
    }

    console.log(courseQuery);

    // Execute the course query
    const [course] = await pool.execute(courseQuery, queryParams);

    if (course.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Get the course details (we'll also fetch associated media and categories)
    const courseDetails = course[0]; // Assuming course[0] is the only course result

    // Fetch associated media
    const [media] = await pool.execute(
      `SELECT media_id, course_id, type, file_name, is_cover 
      FROM res_course_media 
      WHERE course_id = ? AND is_cover = 1`,
      [courseDetails.course_id]
    );

    // Fetch associated categories
    const [categories] = await pool.execute(
      `SELECT c.category_id, c.category_name 
      FROM res_course_categories c
      JOIN res_course_category_relationships pcr ON c.category_id = pcr.category_id
      WHERE pcr.course_id = ?`,
      [courseDetails.course_id]
    );

    // Structure the course data response
    const response = {
      course_id: courseDetails.course_id,
      title: courseDetails.title || "Untitled",
      subtitle: courseDetails.subtitle || "",
      description: courseDetails.description || "",
      language: courseDetails.language || "Unknown",
      sale_price: courseDetails.sale_price || 0,
      original_price: courseDetails.original_price || 0,
      duration_type: courseDetails.duration_type || "N/A",
      duration_value: courseDetails.duration_value || null,
      expiry_date: courseDetails.expiry_date || null,
      created_at: courseDetails.created_at || "",
      media: media || [],
      categories: categories || [],
    };

    return res.status(200).json({
      status: "success",
      data: response,
    });
  } catch (error) {
    console.error("Error fetching course details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}



async function deleteCourse(req, res) {
  const { courseId } = req.params;

  if (!courseId) {
    return res
      .status(400)
      .json({ status: "error", message: "Course ID is required" });
  }

  try {
    const [courseResult] = await pool.execute(
      `DELETE FROM res_courses WHERE course_id = ?`,
      [courseId]
    );

    if (courseResult.affectedRows === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "Course not found" });
    }

    return res.status(200).json({
      status: "success",
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function updateCourse(req, res) {
  const { courseId } = req.params;
  const {
    title,
    subtitle,
    language,
    description,
    sale_price,
    original_price,
    duration_type,
    duration_value,
    expiry_date,
    categories = [],
    newCategories = [],
    tags = [],
    newTags = [],
    media = [],
  } = req.body;

  if (!courseId) {
    return res
      .status(400)
      .json({ status: "error", message: "Course ID is required" });
  }

  const connection = await pool.getConnection(); // Using transactions for atomicity
  try {
    await connection.beginTransaction();

    // Update course data
    await connection.execute(
      `UPDATE res_courses 
      SET title = ?, subtitle = ?, language = ?, description = ?, sale_price = ?, 
      original_price = ?, duration_type = ?, duration_value = ?, expiry_date = ? 
      WHERE course_id = ?`,
      [
        title,
        subtitle,
        language,
        description,
        sale_price,
        original_price,
        duration_type,
        duration_value,
        expiry_date,
        courseId,
      ]
    );

    // Update categories
    const categoriesIds = [...categories];

    for (const categoryName of newCategories) {
      const slug = generateSlug(categoryName);
      const [insertedCategory] = await connection.execute(
        `INSERT INTO res_course_categories (category_name, slug) VALUES (?, ?)`,
        [categoryName, slug]
      );
      categoriesIds.push(insertedCategory.insertId);
    }

    // Insert category relationships
    if (categoriesIds.length > 0) {
      const categoryQueries = categoriesIds.map((categoryId) =>
        connection.execute(
          `INSERT INTO res_course_category_relationships (course_id, category_id) VALUES (?, ?)`,
          [courseId, categoryId]
        )
      );
      await Promise.all(categoryQueries);
    }

    // Update tags

    const tagsIds = [...tags];

    for (const tagName of newTags) {
      const slug = generateSlug(tagName);
      const [insertedTag] = await connection.execute(
        `INSERT INTO res_course_tags (tag_name, slug) VALUES (?, ?)`,
        [tagName, slug]
      );
      tagsIds.push(insertedTag.insertId);
    }

    // Insert tag relationships
    if (tagsIds.length > 0) {
      const tagQueries = tagsIds.map((tagId) =>
        connection.execute(
          `INSERT INTO res_course_tag_relationship (course_id, tag_id) VALUES (?, ?)`,
          [courseId, tagId]
        )
      );
      await Promise.all(tagQueries);
    }

    // Insert media
    if (media.length > 0) {
      const mediaQueries = media.map((mediaItem) =>
        connection.execute(
          `INSERT INTO res_course_media (course_id, type, file_name, is_cover) VALUES (?, ?, ?, ?)`,
          [courseId, mediaItem.type, mediaItem.file_name, mediaItem.is_cover]
        )
      );
      await Promise.all(mediaQueries);
    }

    // Commit transaction
    await connection.commit();
  } catch (error) {
    console.error(error);

    // Rollback transaction in case of error
    await connection.rollback();

    res.status(500).json({
      status: "error",
      message: "Failed to update course",
      error: error.message,
    });
  } finally {
    connection.release();
  }
}

const generateSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

module.exports = {
  createCourse,
  getCourseList,
  getCourseDetails,
  deleteCourse,
  updateCourse,
};
