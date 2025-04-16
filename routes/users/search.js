const express = require("express");
const router = express.Router();

const searchController = require("../../controllers/user/search");

router.get("/", searchController.searchAllTables);
router.get("/counts", searchController.searchAllTablesCounts);

module.exports = router;
