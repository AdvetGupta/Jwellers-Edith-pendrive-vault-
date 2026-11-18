const path = require('path');
const fs = require('fs');
const { Database } = require('./sqlite_shim');
const { AppError } = require('../errors/app-error');

let db = null;
let dbPath = null;
let isDecoyMode = true;

async function open(databasePath) {
  if (!databasePath) {
    throw AppError.invalidOperation('Storage path must point to an authorized Hardware USB Pen Drive.');
  }

  // If already open at the same path, reuse
  if (db && dbPath === databasePath && !isDecoyMode) {
    return db;
  }

  // If currently open at another path or decoy, close previous
  if (db) {
    close();
  }

  dbPath = databasePath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const instance = new Database(dbPath);
  db = await instance.init();
  isDecoyMode = false;

  return db;
}

async function openDecoy() {
  if (db && !isDecoyMode) {
    return db;
  }
  if (db) {
    close();
  }
  const instance = new Database(null); // In-memory SQLite (zero PC disk footprint)
  db = await instance.init();
  dbPath = ':memory:';
  isDecoyMode = true;
  return db;
}

function getDb() {
  if (!db) {
    throw AppError.authorization('Database is not initialized.');
  }
  return db;
}

function getPath() {
  return dbPath;
}

function isDecoy() {
  return isDecoyMode;
}

function close() {
  if (db) {
    try {
      db.close();
    } catch (_) {}
    db = null;
    dbPath = null;
    isDecoyMode = true;
  }
}

function isOpen() {
  return db !== null;
}

module.exports = {
  open,
  openDecoy,
  getDb,
  getPath,
  isDecoy,
  close,
  isOpen
};
