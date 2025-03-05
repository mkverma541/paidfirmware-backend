var express = require("express");
var router = express.Router();

const clientController  = require("../controllers/client");

router.get("/all", clientController.getAllClients);
router.post("/add", clientController.createClient);
router.get('/counts', clientController.getClientCounts);
router.get("/", clientController.getClients);
router.get("/:id", clientController.getClientById);
router.put("/update", clientController.updateClient);


module.exports = router;
