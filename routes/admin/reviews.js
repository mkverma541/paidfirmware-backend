const express = require("express");
const router = express.Router();

const ReviewController = require("../../controllers/admin/reviews");

router.get("/", ReviewController.getFileReviews);
router.put("/update", ReviewController.updateReviewStatus);
router.post("/add", ReviewController.createReview)


module.exports = router;
