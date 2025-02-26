var express = require("express");
var router = express.Router();

const UserController = require("../controllers/user");

router.get("/", UserController.getUsers);
router.get("/:id", UserController.getUserById);
router.put("/update", UserController.updateUser);

module.exports = router;
