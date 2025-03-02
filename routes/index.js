const express = require("express");
const router = express.Router();

const authRouter = require("./auth");
const clientRouter = require("./client");
const accountRouter = require("./account");
const userRouter = require("./user");
const apiRouter = require("./api");
const supplierRouter = require("./supplier");
const projectRouter = require("./projects");

router.use("/auth", authRouter);
router.use("/client", clientRouter);
router.use("/account", accountRouter);
router.use("/users", userRouter);
router.use("/", apiRouter);
router.use("/suppliers", supplierRouter);
router.use("/projects", projectRouter);


module.exports = router;
