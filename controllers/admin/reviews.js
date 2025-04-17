const { pool } = require("../../config/database");

async function createReview(req, res) {
  const { id } = req.user;
  const user_id = id;

  const {
    item_type,
    item_id,
    rating,
    review_text,
    title,
    media
  } = req.body;

  if (!item_type || !item_id || !review_text || !rating) {
    return res.status(400).json({
      message: "Item type, item ID, rating, and review text are required",
      status: "error",
    });
  }

  try {
    // Set review as 'pending' by default
    const [result] = await pool.query(
      `INSERT INTO res_reviews (user_id, item_type, item_id, rating, review_text, title, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, item_type, item_id, rating, review_text, title || null, 'pending']
    );

    const review_id = result.insertId;

    // Insert media if available
    if (media && Array.isArray(media)) {
      const mediaInsertPromises = media.map((url) =>
        pool.query(
          `INSERT INTO res_review_media (review_id, media_url) VALUES (?, ?)`,
          [review_id, url]
        )
      );
      await Promise.all(mediaInsertPromises);
    }

    res.status(201).json({
      message: "Review submitted for approval",
      status: "success",
    });
  } catch (err) {
    console.error("Error creating review:", err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function updateReviewStatus(req, res) {
  const { review_id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    await pool.query(
      `UPDATE res_reviews SET status = ? WHERE id = ?`,
      [status, review_id]
    );

    res.json({
      message: `Review ${status} successfully`,
      status: "success",
    });
  } catch (err) {
    console.error("Error updating review status:", err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}


async function getFileReviews(req, res) {
  const { item_type, item_id } = req.query;

  if (!item_type || !item_id) {
    return res.status(400).json({
      message: "Valid item_type and item_id are required",
      status: "error",
    });
  }

  try {
    // Query to get all approved reviews for this item
    const reviewsQuery = `
      SELECT r.*, u.fullname, u.photo
      FROM res_reviews r
      LEFT JOIN res_users u ON r.user_id = u.user_id
      WHERE r.item_type = ? AND r.item_id = ? AND r.status = 'approved'
      ORDER BY r.created_at DESC
    `;

    // Aggregates: Total number of approved reviews, total sum of star ratings, and average rating
    const aggregatesQuery = `
      SELECT 
        COUNT(*) AS total_reviews,
        IFNULL(SUM(rating), 0) AS total_star_sum,
        IFNULL(AVG(rating), 0) AS average_rating
      FROM res_reviews
      WHERE item_type = ? AND item_id = ? AND status = 'approved'
    `;

    // Run queries in parallel
    const [reviews] = await pool.query(reviewsQuery, [item_type, item_id]);
    const [[aggregates]] = await pool.query(aggregatesQuery, [item_type, item_id]);

    return res.status(200).json({
      reviews,
      summary: {
        total_reviews: aggregates.total_reviews,
        total_star_sum: aggregates.total_star_sum,
        average_rating: aggregates.average_rating.toFixed(1),
        text: `${aggregates.total_star_sum} Stars across ${aggregates.total_reviews} Reviews`,
      },
      status: "success",
    });
  } catch (err) {
    console.error("Error fetching item reviews:", err);
    return res.status(500).json({
      message: "An error occurred while fetching reviews",
      status: "error",
    });
  }
}


module.exports = {
  createReview,
  getFileReviews,
  updateReviewStatus
};
