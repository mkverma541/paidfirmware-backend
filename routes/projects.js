var express = require("express");
var router = express.Router();

const ProjectController  = require("../controllers/projects");

router.post("/add", ProjectController.createProject);
router.get("/list", ProjectController.getAllProjects);
router.get("/:projectId/suppliers", ProjectController.getMappedSuppliers);
router.get("/counts", ProjectController.getProjectStatusCounts);
router.get("/:projectId", ProjectController.getProjectDetailsById);
router.put("/:update", ProjectController.updateProject);
router.put("/update/survey-link", ProjectController.updateProjectSurveyLink);


module.exports = router;
