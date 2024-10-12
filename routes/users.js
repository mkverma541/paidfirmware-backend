const express = require("express");
const router = express.Router();

const userAuthRouter = require("./users/auth");
const digitalFilesRouter = require("./users/files");
const downloadPackagesRouter = require("./users/downloadPackages");
const AccountRouter = require('./users/account');
const cartRouter = require('./users/cart');
const paymentRouter = require('./payment-gateway/index');
const agentRouter = require('./users/agents');
const teamsRouter = require('./users/teams');
const blogsRouter = require('./users/blogs');
const videosRouter = require('./users/videos');
const miscRouter = require('./users/misc');


router.use("/auth", userAuthRouter);
router.use("/", digitalFilesRouter); // File Manager
router.use("/download-packages", downloadPackagesRouter);
router.use("/account", AccountRouter);
router.use("/cart", cartRouter);
router.use("/payment", paymentRouter);
router.use("/agents", agentRouter);
router.use("/teams", teamsRouter);
router.use("/blogs", blogsRouter);
router.use("/videos", videosRouter);
router.use("/pages", miscRouter);


module.exports = router;
