var express = require("express");
var router = express.Router();

const APIManagerController  = require("../../controllers/admin/apiManager");

router.get("/permission/list", APIManagerController.getApiPermissions);
router.post("/add", APIManagerController.addApiKey);
router.get("/list", APIManagerController.getApiKeys);
router.get("/api/:id", APIManagerController.getApiKeyDetails);
router.put("/update", APIManagerController.updateApiKey);
router.delete("/delete/:id", APIManagerController.deleteApiKey);



module.exports = router;
