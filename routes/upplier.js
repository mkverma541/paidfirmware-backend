var express = require("express");
var router = express.Router();

const clientController  = require("../controllers/client");

router.post("/add", clientController.createClient);
router.get("/", clientController.getClients);
router.get("/:id", clientController.getClientById);
router.put("/update/:id", clientController.updateClient);


module.exports = router;
