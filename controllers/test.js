const fs = require('fs');
const path = require('path');

// Read and parse the JSON file
const jsonFilePath = path.join(__dirname, 'data.json');
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

// Perform a map function on the JSON data
const mappedData = jsonData.map(item => {

    // get name key
    return {
        name: item.name,
        icon: item.icon_image_url,
    };
});

console.log(mappedData);