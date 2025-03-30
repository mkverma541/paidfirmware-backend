var express = require("express");
var router = express.Router();

const GroupProjectController  = require("../controllers/reports/groupProject");
const ClientController  = require("../controllers/reports/client");
const supplierController = require("../controllers/reports/supplier");

router.get("/group-project/search", GroupProjectController.searchGroupProject);
router.get("/group-project/child/download", GroupProjectController.downloadProjectReport);
router.get("/group-project", GroupProjectController.getProjectReport);
router.get("/group-project/download", GroupProjectController.downloadGroupProjectReport);

router.get("/client/search", ClientController.searchClients);
router.get("/client/download", ClientController.downloadClientReportExcel);
router.get("/client", ClientController.getClientProjects);

router.get("/supplier/search", supplierController.searchSuppliers);
router.get("/supplier/download", supplierController.downloadSupplierReportExcel);
router.get("/supplier", supplierController.getSupplierProjects);


module.exports = router;
