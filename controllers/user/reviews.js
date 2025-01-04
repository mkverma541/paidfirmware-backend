const { pool } = require("../../config/database");

// Controller to create a new review
async function createReview(req, res) {
  const { id } = req.user;
  const user_id = id;

  const { file_id, rating, review_text } = req.body;

  if (!file_id || !rating || !review_text) {
    return res.status(400).json({
      message: "File ID, rating, and review text are required",
      status: "error",
    });
  }

  try {
    // Insert a new review into the database
    await pool.query(
      `INSERT INTO res_reviews (user_id, file_id, rating, review_text)
       VALUES (?, ?, ?, ?)`,
      [user_id, file_id, rating, review_text]
    );

    res.status(201).json({
      message: "Review created successfully",
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

async function getFileReviews(req, res) {
  const { file_id } = req.body;

  if (!file_id) {
    return res.status(400).json({
      message: "Valid File ID is required",
      status: "error",
    });
  }

  try {
    // Query to get all approved reviews for the given file
    const reviewsQuery = `
      SELECT res_reviews.*, res_users.fullname, res_users.photo
      FROM res_reviews
      LEFT JOIN res_users ON res_reviews.user_id = res_users.user_id
      WHERE res_reviews.file_id = ? AND res_reviews.is_approved = 1`;

    // Query to get the total number of approved reviews
    const countQuery = `
      SELECT COUNT(*) AS total_reviews
      FROM res_reviews
      WHERE res_reviews.file_id = ? AND res_reviews.is_approved = 1`;

    // Query to get the sum of all star ratings for approved reviews
    const totalStarSumQuery = `
      SELECT IFNULL(SUM(res_reviews.rating), 0) AS total_star_sum
      FROM res_reviews
      WHERE res_reviews.file_id = ? AND res_reviews.is_approved = 1`;

    // Run the queries
    const [reviews] = await pool.query(reviewsQuery, [file_id]);
    const [[{ total_reviews }]] = await pool.query(countQuery, [file_id]);
    const [[{ total_star_sum }]] = await pool.query(totalStarSumQuery, [file_id]);

    return res.status(200).json({
      reviews,
      summary: `${total_star_sum} Stars & ${total_reviews} Reviews`,
      status: "success",
    });
  } catch (err) {
    console.error("Error fetching file reviews:", err);
    return res.status(500).json({
      message: "An error occurred while fetching file reviews",
      status: "error",
    });
  }
}


module.exports = {
  createReview,
  getFileReviews,
};
