const express = require("express");
const router = express.Router();

const authRouter = require("./auth");
const clientRouter = require("./client");
const accountRouter = require("./account");
const userRouter = require("./user");
const apiRouter = require("./api");

router.use("/auth", authRouter);
router.use("/client", clientRouter);
router.use("/account", accountRouter);
router.use("/users", userRouter);
router.use("/", apiRouter);


module.exports = router;
