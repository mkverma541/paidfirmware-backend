const express = require("express");
const router = express.Router();

const filesRouter = require("./admin/files");
const adminAuthRouter = require("./admin/auth");
const managePagesRouter = require("./admin/managePages");
const menuRouter = require("./admin/menu");
const teamRouter = require("./admin/team");
const socialPlatForm = require("./admin/socialPlatform");
const agentRouter = require("./admin/agent");
const requestFileRouter = require("./admin/requestFile");
const contactRouter = require("./admin/contactUsEnquiry");
const blogsRouter = require("./admin/blogs");
const videosRouter = require("./admin/videos");
const ordersRouter = require("./admin/orders");
const usersRouter = require("./admin/users");
const userAccountRouter = require("./admin/userAccount");
const dashboardRouter = require("./admin/dashboard");
const downloadPackagerRouter = require("./admin/downloadPackages");
const taxesRouter = require("./admin/taxes");
const siteOptionsRouter = require("./admin/siteOptions");
const filesUploadRouter = require("./admin/files-upload");
const reviewRouter = require("./admin/reviews");
const productRouter = require("./admin/products");
const socialPlatformRouter = require("./admin/socialPlatform");
const apiRouter = require("./admin/api");
const discountRouter = require("./admin/discounts");
const mediaRouter = require("./admin/media");
const walletRouter = require("./admin/wallet");
const jobRouter = require("./admin/jobs");
const settingsRouter = require("./admin/settings");
const currenciesRouter = require("./admin/currencies");
const courseRouter = require("./admin/course");


router.use("/", filesRouter);
router.use("/auth", adminAuthRouter);
router.use("/pages", managePagesRouter);
router.use("/menu", menuRouter);
router.use("/teams", teamRouter);
router.use("/social", socialPlatForm);
router.use("/agents", agentRouter);
router.use("/request-file", requestFileRouter);

router.use("/leads", contactRouter);
router.use("/blogs", blogsRouter);
router.use("/videos", videosRouter);
router.use("/orders", ordersRouter);
router.use("/users", usersRouter);
router.use("/wallet", walletRouter);
router.use("/user/account", userAccountRouter);

router.use("/dashboard", dashboardRouter);
router.use("/download-packages", downloadPackagerRouter);
router.use("/taxes", taxesRouter);
router.use("/settings/options", siteOptionsRouter);
router.use("/files", filesUploadRouter);
router.use("/discounts", discountRouter);
router.use("/reviews", reviewRouter);
router.use("/products", productRouter);
router.use("/social-platforms", socialPlatformRouter);
router.use("/api", apiRouter);
router.use("/media", mediaRouter);
router.use("/jobs", jobRouter);
router.use("/settings", settingsRouter);
router.use("/currencies", currenciesRouter);
router.use("/courses", courseRouter);

module.exports = router;
