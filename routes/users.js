const express = require("express");
const router = express.Router();

const userAuthRouter = require("./users/auth");
const digitalFilesRouter = require("./users/files");
const downloadPackagesRouter = require("./users/downloadPackages");
const AccountRouter = require('./users/account');
const cartRouter = require('./users/cart');
const paymentRouter = require('./payment-gateway/index');


router.use("/auth", userAuthRouter);
router.use("/", digitalFilesRouter); // File Manager
router.use("/download-packages", downloadPackagesRouter);
router.use("/account", AccountRouter);
router.use("/cart", cartRouter);
router.use("/payment", paymentRouter);


module.exports = router;
