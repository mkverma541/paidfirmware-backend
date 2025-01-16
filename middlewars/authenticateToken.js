const jwt = require("jsonwebtoken");
const { secretKey } = require("../config/database");

function authenticateToken(req, res, next) {
  // Retrieve the Authorization header from the request
  const authHeader = req.headers.authorization;

  // Check if the Authorization header is present and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Authorization header missing or invalid" });
  }

  // Extract the token from the Authorization header
  const token = authHeader.split(" ")[1];

  // Verify the token using the secret key
  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      // If there's an error verifying the token, respond with a 403 status code
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }

    // Attach the user information to the request object
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  });
}

module.exports = authenticateToken;
