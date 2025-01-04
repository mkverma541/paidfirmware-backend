const express = require("express");
const router = express.Router();

const ReviewController = require("../../controllers/admin/reviews");

router.get("/", ReviewController.getAllReviews);
router.put("/update", ReviewController.updateReview);

module.exports = router;
