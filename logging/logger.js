const fs = require('fs');
const path = require('path');

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const LOG_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

let logDir = null;
let currentLevel = LOG_LEVELS.INFO;
let logStream = null;
let initialized = false;

// In-Memory Ring Buffer for Zero-PC Footprint
const MAX_MEMORY_LOGS = 500;
const memoryLogs = [];

function init(options = {}) {
  // If memoryOnly is specified or no logDir provided, run 100% in-memory with zero disk footprint
  if (options.memoryOnly) {
    closeStreamOnly();
    logDir = null;
    initialized = true;
    return;
  }

  currentLevel = LOG_LEVELS[options.level] !== undefined ? LOG_LEVELS[options.level] : LOG_LEVELS.INFO;

  if (options.logDir) {
    closeStreamOnly();
    logDir = options.logDir;
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, `vault_${new Date().toISOString().slice(0, 10)}.log`);
      logStream = fs.createWriteStream(logFile, { flags: 'a' });
    } catch (err) {
      console.warn('[Logger] Could not initialize disk stream, falling back to memory-only:', err.message);
      logStream = null;
    }
  }

  initialized = true;
}

function closeStreamOnly() {
  if (logStream) {
    try {
      logStream.end();
    } catch (_) {}
    logStream = null;
  }
}

function close() {
  closeStreamOnly();
  logDir = null;
  initialized = false;
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `[${timestamp}] [${level.padEnd(5)}] ${message}${metaStr}\n`;
}

function log(level, message, meta) {
  if (level > currentLevel) return;

  const line = formatMessage(LOG_NAMES[level], message, meta);

  // 1. Always append to In-Memory Ring Buffer (RAM only)
  memoryLogs.push(line.trim());
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.shift();
  }

  // 2. Write to USB stream if mounted
  if (logStream) {
    try {
      logStream.write(line);
    } catch (_) {}
  }

  // 3. Console output
  if (level <= LOG_LEVELS.WARN) {
    console.error(line.trim());
  } else {
    console.log(line.trim());
  }
}

function error(message, meta) { log(LOG_LEVELS.ERROR, message, meta); }
function warn(message, meta) { log(LOG_LEVELS.WARN, message, meta); }
function info(message, meta) { log(LOG_LEVELS.INFO, message, meta); }
function debug(message, meta) { log(LOG_LEVELS.DEBUG, message, meta); }

function getRecentLogs(limit = 100) {
  return memoryLogs.slice(-limit);
}

module.exports = { init, close, error, warn, info, debug, getRecentLogs, LOG_LEVELS };
