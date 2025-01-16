var express = require("express");
var router = express.Router();

const CourseController = require("../../controllers/admin/courses");
const CategoryController = require("../../controllers/admin/courseCategories");
const TagController = require("../../controllers/admin/courseTags");
const TopicController = require("../../controllers/admin/courseTopic");

// Categories
router.get("/categories/list", CategoryController.listCategories);

// Tags
router.get("/tags/list", TagController.getAllTags);

router.get("/:courseId/topics", TopicController.getCourseTopics);

router.get("/", CourseController.getCourseList);
router.get("/:id", CourseController.getCourseDetails);
router.get("/:slug", CourseController.getCourseDetails);

module.exports = router;
