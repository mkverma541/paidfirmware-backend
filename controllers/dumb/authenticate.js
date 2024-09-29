// authenticate.js
const { google } = require('googleapis');
const credentials = require('./credentials.json');

async function authenticate() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return auth.getClient();
}

module.exports = authenticate;
