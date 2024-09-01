const jwt = require('jsonwebtoken');
const { secretKey } = require('../config/database');

function authenticateToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token not provided' });
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }

    req.user = user; // Attach the user information to the request object
    console.log(user)
    next();
  });
}

module.exports = authenticateToken;
