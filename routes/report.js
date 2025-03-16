var express = require("express");
var router = express.Router();

const ReportController  = require("../controllers/report");

router.get("/project/:projectId/csv", ReportController.generateProjectReport);



module.exports = router;
