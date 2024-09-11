const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const createError = require("http-errors");

require("./config/database");

const app = express();

// Body parser middleware
app.use(bodyParser.json());

// Define allowed origins for CORS
const allowedOrigins = [
  "http://localhost:3001",
  "https://admin.paidfirmware.com",
  "http://localhost:3002",
  "http://localhost:3000",
];

// CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// Import routes

//const usersRouter = require("./routes/users");
const partiesRouter = require("./routes/parties");
const invoicesRouter = require("./routes/invoice");
const filesRouter = require("./routes/files");
const applicationFormRouter = require("./routes/applicationForm");
const TwilloWARouter = require("./routes/twilloWhatsappMessaging");
const packagesRouter = require("./routes/downloadPackages");
const transactionsRouter = require("./routes/transactions");
const transfersRouter = require("./routes/transfers");
const utilsRouter = require("./routes/utils");
const paymentRouter = require("./routes/payment-gateway/razorpay");
const paymentRouterStripe = require("./routes/payment-gateway/stripe.js");
const emailerRouter = require("./routes/emailer");
const adminRoutes = require("./routes/admin/datatables");
const adminAuthRouter = require("./routes/admin/auth");
const userAuthRouter = require("./routes/auth.js");
const cartRouter = require("./routes/cart");

// social login

// Middleware setup
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Use appropriate route prefixes
//app.use("/api/v1", usersRouter);
app.use("/api/v1/parties", partiesRouter);
app.use("/api/v1/invoices/sale", invoicesRouter);
app.use("/api/v1", filesRouter);
app.use("/api/v1", applicationFormRouter);
app.use("/api/v1", TwilloWARouter, packagesRouter);
app.use("/api/utils", utilsRouter);
app.use("/api/v1/admin", adminRoutes,  adminAuthRouter);
app.use("/api/v1/auth/user", userAuthRouter);
app.use("/api/v1", cartRouter);

app.use(
  "/api/v1",
  packagesRouter,
  invoicesRouter,
  transactionsRouter,
  transfersRouter,
  emailerRouter,
);

app.use("/api/v1/payment", paymentRouter, paymentRouterStripe);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

// Export the app for use in other modules
module.exports = app;
