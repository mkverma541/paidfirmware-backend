const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const createError = require("http-errors");


require("./config/database");

// Crons jobs
require('./jobs/updateIsNewCron');

const app = express();

// Body parser middleware
app.use(bodyParser.json());

// CORS configuration
app.use(
  cors({
    origin: '*',
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true,
  })
);

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// Import grouped routes
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");


// Middleware setup
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Use grouped routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/admin", adminRoutes);

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
