var express = require("express");
var router = express.Router();

const supplierController  = require("../controllers/suppplier");

router.get("/all", supplierController.getAllSuppliers);
router.post("/add", supplierController.addSupplier);
router.get("/", supplierController.getSuppliers);
router.get("/:id", supplierController.getSupplierById);
router.put("/update", supplierController.updateSupplier);

module.exports = router;
