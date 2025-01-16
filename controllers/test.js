const ogs = require('open-graph-scraper');

// Define the URL you want to test
const options = { url: 'http://localhost:4200' }; // Replace with your local or live URL

console.log('Testing Open Graph for:', options.url);

ogs(options, (error, results) => {
  if (error) {
    console.error('Error:', error);
  } else {
        console.log('Open Graph Results:', results);
    console.log('Open Graph Results:', results);
  }
});
