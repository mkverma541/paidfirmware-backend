const express = require("express");
const router = express.Router();


const managePagesRouter = require("./admin/managePages")
const menuRouter = require("./admin/menu")
const teamRouter = require("./admin/team")
const socialPlatForm = require("./admin/socialPlatform");
const agentRouter = require("./admin/agent");
const requestFileRouter = require("./admin/requestFile");
const contactRouter = require("./admin/contact");
const blogsRouter = require("./admin/blogs");
const videosRouter = require("./admin/videos");

router.use("/pages", managePagesRouter);
router.use("/menu", menuRouter);
router.use("/teams", teamRouter);
router.use("/social", socialPlatForm);
router.use("/agents", agentRouter);
router.use("/request-file", requestFileRouter);
router.use("/contact", contactRouter);
router.use("/blogs", blogsRouter);
router.use("/videos", videosRouter);

// const adminRoutes = require("./admin/datatables");
// const adminAuthRouter = require("./admin/auth");
// const usersRouters = require("./admin/users");
// const ordersRouters = require("./admin/orders");
// const dashboardRouter = require("./admin/dashboard");

// const partiesRouter = require("./parties");
// const invoicesRouter = require("./invoice");
// const filesRouter = require("./files");
// const applicationFormRouter = require("./applicationForm");
// const TwilloWARouter = require("./twilloWhatsappMessaging");
// const packagesRouter = require("./downloadPackages");
// const transactionsRouter = require("./transactions");
// const transfersRouter = require("./transfers");
// const utilsRouter = require("./utils");
// const emailerRouter = require("./emailer");
// const paymentRouter = require("./payment-gateway/razorpay");
// const paymentRouterStripe = require("./payment-gateway/stripe");

// // Admin-related routes
// router.use("/admin", adminRoutes);
// router.use("/admin/auth", adminAuthRouter);
// router.use("/admin/users", usersRouters);
// router.use("/admin/orders", ordersRouters);
// router.use("/admin/dashboard", dashboardRouter);

// // Store-related routes
// router.use("/parties", partiesRouter);
// router.use("/invoices/sale", invoicesRouter);

// router.use(filesRouter);
// router.use(applicationFormRouter);
// router.use(TwilloWARouter);
// router.use(packagesRouter);
// router.use("/transactions", transactionsRouter);
// router.use("/transfers", transfersRouter);
// router.use("/utils", utilsRouter);
// router.use(emailerRouter);

// // Payment routes
// router.use("/payment", paymentRouter);
// router.use("/payment", paymentRouterStripe);

module.exports = router;
