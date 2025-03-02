var express = require("express");
var router = express.Router();

const ProjectController  = require("../controllers/projects");

router.post("/add", ProjectController.createProject);
router.get("/list", ProjectController.getAllProjects);
router.get("/:projectId", ProjectController.getProjectDetailsById);


module.exports = router;
