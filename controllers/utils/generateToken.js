const crypto = require("crypto");

const secretKey = "your-very-simple-secret-key";

// Function to create a signed token with necessary fields
function generateToken(fileId, expirationTime) {
  // Create the token data
  const tokenData = { fileId, expirationTime };

  // Serialize the token data to a JSON string
  const tokenString = JSON.stringify(tokenData);

  // Create the HMAC signature from the token string
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(tokenString)
    .digest("hex"); // Use the full signature without slicing

  // Encode the token data in base64 and append the signature
  const token = `${Buffer.from(tokenString).toString("base64")}.${signature}`;

  // Return the full token
  return token;
}

// Export the function properly
module.exports = generateToken;