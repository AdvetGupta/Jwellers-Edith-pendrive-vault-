const path = require('path');
const fs = require('fs');

const CONFIG = {
  app: {
    name: 'Jwellers Edith',
    version: '1.3.0',
    creator: "AD's Creation"
  },
  database: {
    defaultPath: process.env.JWELLERS_DB_PATH || null,
    schemaVersion: 1
  },
  paths: {
    userData: process.env.JWELLERS_USER_DATA || (process.env.APPDATA
      ? path.join(process.env.APPDATA, '.jwellers-edith')
      : path.join(process.env.HOME || process.env.USERPROFILE, '.jwellers-edith')),
    logs: null,
    exports: null,
    backups: null
  },
  security: {
    passwordHashAlgorithm: 'sha256',
    sessionTimeoutHours: 24
  },
  defaults: {
    currency: '₹',
    dateFormat: 'DD/MM/YYYY',
    invoicePrefix: 'INV-',
    gstRate: 3.0
  }
};

CONFIG.paths.logs = path.join(CONFIG.paths.userData, 'logs');
CONFIG.paths.exports = path.join(CONFIG.paths.userData, 'exports');
CONFIG.paths.backups = path.join(CONFIG.paths.userData, 'backups');

function ensureDirectories() {
  for (const dir of Object.values(CONFIG.paths)) {
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = { CONFIG, ensureDirectories };
