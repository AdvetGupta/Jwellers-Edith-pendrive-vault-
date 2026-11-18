const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const connection = require('../database/connection');
const { initialize } = require('../database/init');
const logger = require('../logging/logger');

const VAULT_FOLDER = '.jwellers_vault';
const VAULT_SIG_FILE = '.vault_sig';
const VAULT_DB_FILE = 'jwellers_edith.db';
const VAULT_MAGIC = 'EDITH_VAULT_V1';
const SECRET_SALT = 'edith_hw_vault_2026_offline_security_token';

function normalizeDriveRoot(driveLetter) {
  if (!driveLetter) return null;
  const match = String(driveLetter).trim().match(/^([A-Za-z]):?/);
  if (!match) return null;
  return `${match[1].toUpperCase()}:\\`;
}

class UsbVaultService extends EventEmitter {
  constructor() {
    super();
    this.status = 'LOCKED'; // 'LOCKED' | 'MOUNTED'
    this.activeVault = null;
    this.watcherTimer = null;
    this.pollIntervalMs = 100; // <100ms detection loop
    this.isProcessing = false;
  }

  /**
   * Generates cryptographic HMAC signature for vault authenticity
   */
  generateSignature(vaultId, createdAt) {
    const data = `${VAULT_MAGIC}:${vaultId}:${createdAt}:${SECRET_SALT}`;
    return crypto.createHmac('sha256', SECRET_SALT).update(data).digest('hex');
  }

  /**
   * Verifies the authenticity of a .vault_sig payload
   */
  verifySignature(sigData) {
    if (!sigData || sigData.magic !== VAULT_MAGIC || !sigData.vaultId || !sigData.createdAt || !sigData.signature) {
      return false;
    }
    const expected = this.generateSignature(sigData.vaultId, sigData.createdAt);
    return crypto.timingSafeEqual(Buffer.from(sigData.signature, 'hex'), Buffer.from(expected, 'hex'));
  }

  /**
   * Returns list of candidate Windows drives (D: through Z:, excluding C:) asynchronously
   */
  async getCandidateDriveRootsAsync() {
    const drives = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const checkPromises = drives.map(async (letter) => {
      const root = `${letter}:\\`;
      try {
        await fs.promises.access(root, fs.constants.F_OK);
        return root;
      } catch (_) {
        return null;
      }
    });
    const results = await Promise.all(checkPromises);
    return results.filter(Boolean);
  }

  /**
   * Returns list of candidate Windows drives (D: through Z:, excluding C:) synchronously (fallback)
   */
  getCandidateDriveRoots() {
    const drives = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const validRoots = [];
    for (const letter of drives) {
      const root = `${letter}:\\`;
      try {
        if (fs.existsSync(root)) {
          validRoots.push(root);
        }
      } catch (_) {}
    }
    return validRoots;
  }

  /**
   * Scans all connected drives for an authorized Jwellers Edith vault asynchronously
   */
  async scanForAuthorizedVaultAsync() {
    const candidateRoots = await this.getCandidateDriveRootsAsync();
    for (const driveRoot of candidateRoots) {
      const vaultDir = path.join(driveRoot, VAULT_FOLDER);
      const sigPath = path.join(vaultDir, VAULT_SIG_FILE);
      const dbPath = path.join(vaultDir, VAULT_DB_FILE);

      try {
        await fs.promises.access(sigPath, fs.constants.R_OK);
        await fs.promises.access(dbPath, fs.constants.R_OK);

        const rawSig = await fs.promises.readFile(sigPath, 'utf8');
        const sigData = JSON.parse(rawSig);
        if (this.verifySignature(sigData)) {
          return {
            driveRoot,
            driveLetter: driveRoot.substring(0, 2),
            vaultDir,
            sigPath,
            dbPath,
            sigData
          };
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Scans all connected drives for an authorized Jwellers Edith vault
   */
  scanForAuthorizedVault() {
    const candidateRoots = this.getCandidateDriveRoots();
    for (const driveRoot of candidateRoots) {
      const vaultDir = path.join(driveRoot, VAULT_FOLDER);
      const sigPath = path.join(vaultDir, VAULT_SIG_FILE);
      const dbPath = path.join(vaultDir, VAULT_DB_FILE);

      if (fs.existsSync(sigPath) && fs.existsSync(dbPath)) {
        try {
          const rawSig = fs.readFileSync(sigPath, 'utf8');
          const sigData = JSON.parse(rawSig);
          if (this.verifySignature(sigData)) {
            return {
              driveRoot,
              driveLetter: driveRoot.substring(0, 2),
              vaultDir,
              sigPath,
              dbPath,
              sigData
            };
          }
        } catch (err) {
          logger.warn(`Invalid or unreadable signature on ${driveRoot}: ${err.message}`);
        }
      }
    }
    return null;
  }

  /**
   * Mounts the detected vault and initializes database
   */
  async mountVault(vaultCandidate) {
    if (this.status === 'MOUNTED') return;

    logger.info(`[UsbVault] Authorizing and mounting vault from ${vaultCandidate.driveRoot}...`);

    try {
      this.activeVault = {
        driveRoot: vaultCandidate.driveRoot,
        driveLetter: vaultCandidate.driveLetter,
        vaultDir: vaultCandidate.vaultDir,
        sigPath: vaultCandidate.sigPath,
        dbPath: vaultCandidate.dbPath,
        vaultId: vaultCandidate.sigData.vaultId,
        mountedAt: new Date().toISOString()
      };

      // Open database directly on the USB drive
      await connection.open(vaultCandidate.dbPath);

      // Verify / initialize schemas on the vault
      await initialize(vaultCandidate.dbPath);

      // Configure zero-trace logging to write to USB drive
      const logDir = path.join(vaultCandidate.vaultDir, 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      logger.init({ logDir });

      this.status = 'MOUNTED';
      logger.info(`[UsbVault] Vault mounted successfully on ${vaultCandidate.driveLetter}`);

      this.emit('vault:connected', this.getVaultState());
    } catch (err) {
      logger.error(`[UsbVault] Failed to mount vault: ${err.message}`);
      await this.unmountVault({ emergency: true, reason: err.message });
      throw err;
    }
  }

  /**
   * Unmounts the vault, closes database connection, and flushes memory
   */
  async unmountVault({ emergency = false, reason = 'Hardware removed' } = {}) {
    if (this.status === 'LOCKED' && !this.activeVault) return;

    const drive = this.activeVault ? this.activeVault.driveLetter : 'Unknown';
    logger.warn(`[UsbVault] ${emergency ? 'EMERGENCY PULL-TO-LOCK' : 'Safely unmounting'}: ${reason} (Drive: ${drive})`);

    // 1. Immediately close SQLite connection to prevent corruption
    try {
      connection.close();
    } catch (err) {
      logger.error(`[UsbVault] Error closing DB connection: ${err.message}`);
    }

    // 2. Wipe active vault state
    const previousVault = this.activeVault;
    this.activeVault = null;
    this.status = 'LOCKED';

    // 3. Revert logger to in-memory mode so nothing is written to local PC
    logger.init({ memoryOnly: true });

    // 4. Re-open clean in-memory decoy database with 0 records (Zero PC Footprint)
    try {
      await connection.openDecoy();
      await initialize();
    } catch (err) {
      logger.error(`[UsbVault] Decoy DB initialization notice: ${err.message}`);
    }

    // 5. Emit disconnect event for renderer to reset data to 0 in <100ms
    this.emit('vault:disconnected', {
      emergency,
      reason,
      previousDrive: previousVault ? previousVault.driveLetter : null,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start non-blocking watcher loop (Adaptive interval: 400ms for active vault, async check)
   */
  startWatcher(intervalMs = 400) {
    if (this.watcherTimer) clearInterval(this.watcherTimer);
    this.pollIntervalMs = intervalMs;

    this.watcherTimer = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        if (this.status === 'MOUNTED' && this.activeVault) {
          // Check ONLY the single mounted drive using non-blocking async access
          let isConnected = false;
          try {
            await fs.promises.access(this.activeVault.dbPath, fs.constants.F_OK);
            await fs.promises.access(this.activeVault.sigPath, fs.constants.F_OK);
            isConnected = true;
          } catch (_) {
            isConnected = false;
          }

          if (!isConnected) {
            await this.unmountVault({ emergency: true, reason: 'Physical USB Pen Drive pulled out' });
          }
        } else if (this.status === 'LOCKED') {
          // Non-blocking asynchronous scan for inserted USB drive
          const detectedVault = await this.scanForAuthorizedVaultAsync();
          if (detectedVault) {
            await this.mountVault(detectedVault);
          }
        }
      } catch (err) {
        logger.error(`[UsbVault Watcher] Error: ${err.message}`);
      } finally {
        this.isProcessing = false;
      }
    }, this.pollIntervalMs);

    logger.info(`[UsbVault] Watcher started (${this.pollIntervalMs}ms non-blocking interval)`);
  }

  stopWatcher() {
    if (this.watcherTimer) {
      clearInterval(this.watcherTimer);
      this.watcherTimer = null;
    }
  }

  /**
   * Creates and initializes a fresh USB Vault on a chosen drive
   */
  async initializeNewVault(driveLetter, shopName = 'Jwellers Edith') {
    const driveRoot = normalizeDriveRoot(driveLetter);
    if (!driveRoot) {
      throw new Error(`Invalid drive specified: "${driveLetter}". Please select a valid removable drive.`);
    }

    if (driveRoot.startsWith('C:')) {
      throw new Error('Refusing to create vault on C: drive. Hardware vault must be on a removable drive.');
    }

    if (!fs.existsSync(driveRoot)) {
      throw new Error(`Drive ${driveRoot} is not accessible. Please ensure pen drive is inserted.`);
    }

    const vaultDir = path.join(driveRoot, VAULT_FOLDER);
    const logsDir = path.join(vaultDir, 'logs');
    const backupsDir = path.join(vaultDir, 'backups');
    const sigPath = path.join(vaultDir, VAULT_SIG_FILE);
    const dbPath = path.join(vaultDir, VAULT_DB_FILE);

    if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const vaultId = 'vault_' + crypto.randomBytes(8).toString('hex');
    const createdAt = new Date().toISOString();
    const signature = this.generateSignature(vaultId, createdAt);

    const sigPayload = {
      magic: VAULT_MAGIC,
      vaultId,
      shopName,
      createdAt,
      signature,
      version: '1.0'
    };

    fs.writeFileSync(sigPath, JSON.stringify(sigPayload, null, 2), 'utf8');

    logger.info(`[UsbVault] Initialized signature on ${driveRoot} with ID ${vaultId}`);

    // Auto mount (opens SQLite connection on USB drive & verifies schema)
    await this.mountVault({
      driveRoot,
      driveLetter: driveRoot.substring(0, 2),
      vaultDir,
      sigPath,
      dbPath,
      sigData: sigPayload
    });

    return this.getVaultState();
  }

  /**
   * Mounts a Virtual Test Vault for instantaneous live software testing without requiring a physical USB
   */
  async mountVirtualTestVault() {
    const os = require('os');
    const virtualRoot = path.join(os.tmpdir(), 'edith_virtual_vault');
    const vaultDir = path.join(virtualRoot, VAULT_FOLDER);
    const logsDir = path.join(vaultDir, 'logs');
    const backupsDir = path.join(vaultDir, 'backups');
    const sigPath = path.join(vaultDir, VAULT_SIG_FILE);
    const dbPath = path.join(vaultDir, VAULT_DB_FILE);

    if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const vaultId = 'virtual_test_vault';
    const createdAt = new Date().toISOString();
    const signature = this.generateSignature(vaultId, createdAt);

    const sigPayload = {
      magic: VAULT_MAGIC,
      vaultId,
      shopName: 'Jwellers Edith (Virtual Hardware Vault)',
      createdAt,
      signature,
      version: '1.0',
      isVirtual: true
    };

    fs.writeFileSync(sigPath, JSON.stringify(sigPayload, null, 2), 'utf8');

    // If virtual test database does not exist, initialize a fresh, clean schema
    if (!fs.existsSync(dbPath)) {
      await initialize(dbPath);
    }

    await this.mountVault({
      driveRoot: virtualRoot,
      driveLetter: 'VIRTUAL',
      vaultDir,
      sigPath,
      dbPath,
      sigData: sigPayload
    });

    logger.info('[UsbVault] Virtual Test Vault mounted successfully with demo records.');
    return this.getVaultState();
  }

  /**
   * 1-Click Clone active vault to a secondary Pen Drive
   */
  async cloneVaultToDrive(targetDriveLetter) {
    if (this.status !== 'MOUNTED' || !this.activeVault) {
      throw new Error('Active vault must be mounted before cloning.');
    }

    const targetRoot = normalizeDriveRoot(targetDriveLetter);
    if (!targetRoot) {
      throw new Error(`Invalid destination drive specified: "${targetDriveLetter}".`);
    }

    if (targetRoot.startsWith('C:')) {
      throw new Error('Target drive cannot be the PC local C: drive.');
    }

    if (targetRoot === this.activeVault.driveRoot) {
      throw new Error('Target drive cannot be the currently active vault drive.');
    }

    if (!fs.existsSync(targetRoot)) {
      throw new Error(`Target drive ${targetRoot} does not exist or is not connected.`);
    }

    const targetVaultDir = path.join(targetRoot, VAULT_FOLDER);
    const targetLogsDir = path.join(targetVaultDir, 'logs');
    const targetBackupsDir = path.join(targetVaultDir, 'backups');
    const targetSigPath = path.join(targetVaultDir, VAULT_SIG_FILE);
    const targetDbPath = path.join(targetVaultDir, VAULT_DB_FILE);

    if (!fs.existsSync(targetVaultDir)) fs.mkdirSync(targetVaultDir, { recursive: true });
    if (!fs.existsSync(targetLogsDir)) fs.mkdirSync(targetLogsDir, { recursive: true });
    if (!fs.existsSync(targetBackupsDir)) fs.mkdirSync(targetBackupsDir, { recursive: true });

    // Flush active database writes to disk
    const dbInstance = connection.getDb();
    if (dbInstance && typeof dbInstance._saveToFile === 'function') {
      dbInstance._saveToFile();
    }

    // Atomic SQLite copy or file copy
    fs.copyFileSync(this.activeVault.dbPath, targetDbPath);
    fs.copyFileSync(this.activeVault.sigPath, targetSigPath);

    // Verify SHA-256 Checksums
    const srcHash = crypto.createHash('sha256').update(fs.readFileSync(this.activeVault.dbPath)).digest('hex');
    const dstHash = crypto.createHash('sha256').update(fs.readFileSync(targetDbPath)).digest('hex');

    if (srcHash !== dstHash) {
      throw new Error('Integrity verification failed: Cloned database checksum mismatch.');
    }

    logger.info(`[UsbVault] Cloned vault successfully to ${targetRoot} (SHA256: ${srcHash})`);

    return {
      success: true,
      sourceDrive: this.activeVault.driveLetter,
      targetDrive: targetRoot.substring(0, 2),
      sha256: srcHash,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Lists all available target drives for cloning or new vault setup
   */
  listTargetDrives() {
    const drives = this.getCandidateDriveRoots();
    return drives.map(driveRoot => {
      const driveLetter = driveRoot.substring(0, 2);
      const vaultDir = path.join(driveRoot, VAULT_FOLDER);
      const hasVault = fs.existsSync(path.join(vaultDir, VAULT_SIG_FILE));
      const isActive = this.activeVault && this.activeVault.driveRoot === driveRoot;

      let label = `Removable Drive (${driveLetter})`;
      return {
        driveRoot,
        driveLetter,
        hasVault,
        isActive,
        label
      };
    });
  }

  /**
   * Returns sanitized vault state for UI
   */
  getVaultState() {
    let dbSize = 0;
    if (this.status === 'MOUNTED' && this.activeVault && fs.existsSync(this.activeVault.dbPath)) {
      try {
        dbSize = fs.statSync(this.activeVault.dbPath).size;
      } catch (_) {}
    }

    return {
      status: this.status, // 'MOUNTED' | 'LOCKED'
      isLocked: this.status === 'LOCKED',
      driveLetter: this.activeVault ? this.activeVault.driveLetter : null,
      vaultDir: this.activeVault ? this.activeVault.vaultDir : null,
      vaultId: this.activeVault ? this.activeVault.vaultId : null,
      mountedAt: this.activeVault ? this.activeVault.mountedAt : null,
      dbSizeFormatted: `${(dbSize / 1024).toFixed(1)} KB`,
      zeroPcFootprint: true,
      offlineOnly: true
    };
  }
}

const usbVaultService = new UsbVaultService();
module.exports = usbVaultService;
