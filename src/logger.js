const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'bot.log');

// Clear log on start
fs.writeFileSync(logFile, '');

function log(...args) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const msg = `[${timestamp}] ${args.join(' ')}\n`;
  fs.appendFileSync(logFile, msg);
  console.log(...args);
}

module.exports = { log };
