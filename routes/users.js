const express = require("express");
const router = express.Router();

const userAuthRouter = require("./users/auth");
const digitalFilesRouter = require("./users/files");
const downloadPackagesRouter = require("./users/downloadPackages");
const cartRouter = require('./users/cart');
const paymentRouter = require('./payment-gateway/index');
const agentRouter = require('./users/agents');
const teamsRouter = require('./users/teams');
const blogsRouter = require('./users/blogs');
const videosRouter = require('./users/videos');
const pagesRouter = require('./users/pages');
const searchRouter = require('./users/search');
const menuRouter = require('./users/menu');
const couponRouter = require('./users/coupons');
const reviewRouter = require('./users/reviews');
const requestFileRouter = require('./users/requestFile');
const contactUsEnquiryRouter = require('./users/contactUsEnquiry');
const productsRouter = require('./users/products');
const productRouter = require('./users/product');
const walletRouter = require('./users/wallet');
const dashboardRouter = require('./users/dashboard');
const locationRouter = require("./users/location");
const currencyRouter = require("./users/currencies");
const courseRouter = require("./users/courses");
const userAccountRouter = require("./users/account/index");

// shared
const orderRouter = require("./shared/order");

// middleware



router.use("/auth", userAuthRouter);
router.use("/", digitalFilesRouter); // File Manager
router.use("/download-packages", downloadPackagesRouter);
router.use("/account", userAccountRouter);
router.use("/cart", cartRouter);
router.use("/payment", paymentRouter);
router.use("/agents", agentRouter);
router.use("/teams", teamsRouter);
router.use("/blogs", blogsRouter);
router.use("/videos", videosRouter);
router.use("/pages", pagesRouter);
router.use("/order", orderRouter);
router.use("/search", searchRouter);
router.use("/menu", menuRouter);
router.use("/coupons", couponRouter);
router.use("/reviews", reviewRouter);
router.use("/request-file", requestFileRouter);
router.use("/leads", contactUsEnquiryRouter);
router.use("/products",  productsRouter);
router.use("/product", productRouter);
router.use("/wallet", walletRouter);
router.use("/dashboard", dashboardRouter);
router.use("/currencies", currencyRouter);
router.use("/courses", courseRouter);

module.exports = router;
