const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../logging/logger');
const { registerAllIpcHandlers } = require('./ipc');
const usbVaultService = require('../services/usb_vault.service');

let mainWindow = null;
let volatileUserDataDir = null;

const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const RENDERER_PATH = path.join(__dirname, '..', 'renderer', 'index.html');

// Configure Zero-Trace PC Hardening on Electron app before ready
if (process.versions && process.versions.electron) {
  try {
    const { app } = require('electron');
    // 1. Disable Chrome disk, media, and shader caches on PC hard drive
    app.commandLine.appendSwitch('disable-http-cache');
    app.commandLine.appendSwitch('disk-cache-size', '0');
    app.commandLine.appendSwitch('media-cache-size', '0');
    app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

    // 2. Point userData to a volatile temporary directory that purges on exit
    volatileUserDataDir = path.join(os.tmpdir(), `edith_vault_session_${Date.now()}`);
    if (!fs.existsSync(volatileUserDataDir)) {
      fs.mkdirSync(volatileUserDataDir, { recursive: true });
    }
    app.setPath('userData', volatileUserDataDir);
  } catch (err) {
    console.warn('[ZeroTrace] Hardening setup notice:', err.message);
  }
}

function cleanupZeroTraceOnExit() {
  if (volatileUserDataDir && fs.existsSync(volatileUserDataDir)) {
    try {
      fs.rmSync(volatileUserDataDir, { recursive: true, force: true });
      console.log('[ZeroTrace] Volatile session directory purged from PC.');
    } catch (_) {}
    volatileUserDataDir = null;
  }
}

function createWindow() {
  const { BrowserWindow, globalShortcut } = require('electron');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1040,
    minHeight: 720,
    title: 'Jwellers Edith',
    backgroundColor: '#0a0c0f',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: true // Display immediately
  });

  mainWindow.loadFile(RENDERER_PATH);

  mainWindow.webContents.on('did-finish-load', () => {
    // Dispatch initial vault state to renderer
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('vault:statusChange', usbVaultService.getVaultState());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Emergency Lock Hotkey (Ctrl+L)
  if (globalShortcut) {
    try {
      globalShortcut.register('CommandOrControl+L', () => {
        logger.info('[Shortcut] Emergency lock triggered via Ctrl+L');
        usbVaultService.unmountVault({ emergency: false, reason: 'Emergency Panic Hotkey (Ctrl+L)' });
      });
    } catch (e) {
      logger.warn('[Shortcut] Could not register Ctrl+L lock shortcut:', e.message);
    }
  }
}

async function start() {
  // Start logger in zero-trace memory-only mode initially
  logger.init({ memoryOnly: true });
  logger.info('Jwellers Edith starting in stealth decoy mode...');

  // Initialize clean stealth decoy database in-memory (0 records, zero PC footprint)
  try {
    const connection = require('../database/connection');
    const { initialize } = require('../database/init');
    await connection.openDecoy();
    await initialize();
  } catch (err) {
    logger.warn(`Decoy init notice: ${err.message}`);
  }

  // Register all IPC handlers
  registerAllIpcHandlers();
  logger.info('IPC handlers registered');

  // Wire USB Vault events to UI
  usbVaultService.on('vault:connected', (state) => {
    logger.info(`[Main] Vault connected event on drive ${state.driveLetter}`);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.setTitle('Jwellers Edith');
      mainWindow.webContents.send('vault:connected', state);
      mainWindow.webContents.send('vault:statusChange', state);
    }
  });

  usbVaultService.on('vault:disconnected', (info) => {
    logger.warn(`[Main] Vault disconnected: ${info.reason}`);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.setTitle('Jwellers Edith');
      mainWindow.webContents.send('vault:disconnected', info);
      mainWindow.webContents.send('vault:statusChange', usbVaultService.getVaultState());
    }
  });

  // Start USB hardware watcher (Non-blocking adaptive interval)
  usbVaultService.startWatcher(500);

  if (process.versions && process.versions.electron) {
    createWindow();
    logger.info('Application window created');
  } else {
    logger.info('Running in headless mode (no Electron). USB Watcher active.');
  }

  return { status: 'running', vaultState: usbVaultService.getVaultState() };
}

async function shutdown() {
  logger.info('Shutting down Hardware Vault...');
  usbVaultService.stopWatcher();
  await usbVaultService.unmountVault({ emergency: false, reason: 'System shutdown' });
  cleanupZeroTraceOnExit();
  logger.close();
}

// Bootstrap Electron Lifecycle
if (process.versions && process.versions.electron) {
  const { app, globalShortcut } = require('electron');

  // Single-Instance Lock: Prevent multiple windows/instances from overwriting DB with stale in-memory state
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    console.warn('[Process] Another instance is already running. Exiting immediately to prevent database overwrite.');
    app.quit();
  } else {
    app.on('second-instance', () => {
      // Focus the existing window if a second instance is launched
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      start();
    });

    app.on('will-quit', () => {
      if (globalShortcut) globalShortcut.unregisterAll();
      usbVaultService.stopWatcher();
      usbVaultService.unmountVault({ emergency: false, reason: 'Application quit' });
      cleanupZeroTraceOnExit();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }
}

module.exports = { start, shutdown };
