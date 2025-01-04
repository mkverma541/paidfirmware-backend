const fs = require('fs');
const path = require('path');

// Create a writable log file stream
const logFile = fs.createWriteStream(path.join(__dirname, 'logs', 'app.log'), { flags: 'a' });

// Override console methods
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
    const message = `[LOG] ${new Date().toISOString()} - ${args.join(' ')}\n`;
    logFile.write(message); // Write to file
    originalLog.apply(console, args); // Keep original behavior
};

console.error = function (...args) {
    const message = `[ERROR] ${new Date().toISOString()} - ${args.join(' ')}\n`;
    logFile.write(message); // Write to file
    originalError.apply(console, args); // Keep original behavior
};

// Optionally override other methods like console.warn, console.debug, etc.
