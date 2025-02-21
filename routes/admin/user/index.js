const express = require("express");
const router = express.Router();

const courseRouter = require("./courses");
const profileRouter = require("./profile");
const orderRouter = require("./orders");
const downloadsRouters = require("./downloads");
const downloadPackagesRouter = require("./downloadPackages");
const walletRouter = require("./wallet");
const transactionRouter = require("./transactions");

router.use("/courses", courseRouter);
router.use("/profile", profileRouter);
router.use("/orders", orderRouter);
router.use("/downloads", downloadsRouters);
router.use("/packages", downloadPackagesRouter);
router.use("/wallet", walletRouter);
router.use("/transactions", transactionRouter);

module.exports = router;
