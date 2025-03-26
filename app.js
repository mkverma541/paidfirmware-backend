const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const bodyParser = require("body-parser");
const compression = require("compression");
const cors = require("cors");
const createError = require("http-errors");
require("./logger");

// Cron Jobs
require("./jobs/updateIsNewCron");

const app = express();

// Enable Gzip Compression (Faster Response)
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true,
  })
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Logger (Only in development mode)
if (process.env.NODE_ENV === "development") {
  app.use(logger("dev"));
}

// Serve static files with caching
app.use(
  "/static",
  express.static(path.join(__dirname, "public"), {
    maxAge: "1y",
    etag: false,
    lastModified: false,
  })
);

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.get("/", (req, res) => {
  res.render("index", { title: "Express" });
});

// Import grouped routes
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");

// Use grouped routes
app.use("/api", apiRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/user", userRoutes);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.render("error", {
    message: err.message || "Something went wrong",
    status: err.status || 500,
    error: req.app.get("env") === "development" ? err : {}, // Show stack trace in development
  });
});

// Export the app for use in other modules
module.exports = app;
