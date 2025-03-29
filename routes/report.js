var express = require("express");
var router = express.Router();

const GroupProjectController  = require("../controllers/reports/groupProject");
const ClientController  = require("../controllers/reports/client");

router.get("/group-project/search", GroupProjectController.searchGroupProject);
router.get("/group-project/child/download", GroupProjectController.downloadProjectReport);
router.get("/group-project", GroupProjectController.getProjectReport);
router.get("/group-project/download", GroupProjectController.downloadGroupProjectReport);

router.get("/client/search", ClientController.searchClients);
router.get("/client/download", ClientController.downloadClientReportExcel);
router.get("/client", ClientController.getClientProjects);


module.exports = router;
