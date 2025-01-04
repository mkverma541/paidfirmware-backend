const { pool } = require("../../config/database");

async function getAllReviews(req, res) {
  try {
    // Get page and limit from query parameters, with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Query to get paginated reviews with user details
    const reviewsQuery = `
        SELECT 
          res_reviews.review_id,
          res_reviews.user_id,
          res_reviews.file_id,
          res_reviews.product_id,
          res_reviews.course_id,
          res_reviews.rating,
          res_reviews.review_text,
          res_reviews.status,
          res_reviews.created_at,
          res_users.fullname,
          res_users.photo
        FROM res_reviews
        LEFT JOIN res_users ON res_reviews.user_id = res_users.user_id
        ORDER BY res_reviews.created_at DESC
        LIMIT ? OFFSET ?`;

    // Run the query with pagination
    const [reviews] = await pool.query(reviewsQuery, [limit, offset]);

    // Query to get the total count of reviews for pagination metadata
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM res_reviews`);

    const result = {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
      data: reviews,
    }

    return res.status(200).json({
      message: "Fetched all reviews successfully",
      status: "success",
      response: result,
    });
  } catch (err) {
    console.error("Error fetching all reviews:", err);
    return res.status(500).json({
      message: "An error occurred while fetching reviews",
      status: "error",
    });
  }
}

async function updateReview(req, res) {
  try {
    const { review_id, status } = req.body;

    // Query to update the review's approval status
    const updateReviewQuery = `
            UPDATE res_reviews
            SET status = ?
            WHERE review_id = ?`;

    // Run the query
    await pool.query(updateReviewQuery, [status, review_id]);

    return res.status(200).json({
      message: "Review updated successfully",
      status: "success",
    });
  } catch (err) {
    console.error("Error updating review:", err);
    return res.status(500).json({
      message: "An error occurred while updating review",
      status: "error",
    });
  }
}

module.exports = { getAllReviews, updateReview };
