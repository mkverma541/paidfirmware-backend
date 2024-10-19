const axios = require("axios");
const { pool } = require("../../config/database"); // Adjust the path as necessary

async function getUserLocation(req, res) {
  try {
    // Use a hardcoded IP address for testing or get IP from headers
    const ip = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.connection.remoteAddress || req.socket.remoteAddress;

    let country_name = "India";
    let country_code = "IN";
    let city = "Unknown";
    let state = "Unknown";
    let IPv4 = ip || "0.0.0.0";
    let latitude = null;
    let longitude = null;

    // If IP is available, get geolocation data
    if (ip && ip !== "0.0.0.0") {
      try {
        const geoResponse = await axios.get(
          `https://geolocation-db.com/json/${ip}&position=true`
        );

        country_name = geoResponse.data.country_name || country_name;
        country_code = geoResponse.data.country_code || country_code;
        city = geoResponse.data.city || city;
        state = geoResponse.data.state || state;
        IPv4 = geoResponse.data.IPv4 || IPv4;
        latitude = geoResponse.data.latitude;
        longitude = geoResponse.data.longitude;
      } catch (geoError) {
        console.warn("Geolocation service failed, using default values:", geoError.message);
      }
    }

    // Query the database to get the currency code
    const currencyQueryPromise = pool.execute(
      `SELECT currency_code FROM res_currencies WHERE country_code = ? AND is_active = 1`,
      [country_code]
    );

    // Wait for the currency query to complete
    const [currencyRows] = await currencyQueryPromise;

    const currencyCode = currencyRows.length > 0 ? currencyRows[0].currency_code : null; // Get the first active currency code

    // Prepare the response data
    const responseData = {
      ip: IPv4,
      country: country_name,
      countryCode: country_code,
      city,
      state,
      latitude,
      longitude,
      currencyCode, // Include the currency code
    };

    // Send the response back
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching IP information:", error);
    res.status(500).json({ message: "Unable to determine location", error: error.message });
  }
}

module.exports = {
  getUserLocation,
};
