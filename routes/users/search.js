const express = require("express");
const router = express.Router();

const searchController = require("../../controllers/user/search");

router.get("/", searchController.searchAllTables);

module.exports = router;
