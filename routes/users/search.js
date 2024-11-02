const express = require("express");
const router = express.Router();

const searchController = require("../../controllers/user/search");

router.get("/", searchController.searchFilesFolders);

module.exports = router;
