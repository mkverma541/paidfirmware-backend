var express = require("express");
var router = express.Router();

const GroupProjectController  = require("../controllers/reports/groupProject");

router.get("/group-project/search", GroupProjectController.searchGroupProject);
router.get("/group-project/list", GroupProjectController.getList);
router.get("/group-project/child/download-excel", GroupProjectController.downloadInExcel);
router.get("/group-project/child", GroupProjectController.getChildProjectReport);


module.exports = router;
