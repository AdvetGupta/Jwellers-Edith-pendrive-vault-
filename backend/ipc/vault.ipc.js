const { ipcMain } = require('electron');
const usbVaultService = require('../../services/usb_vault.service');
const logger = require('../../logging/logger');

function registerVaultIpc() {
  // Get current vault status
  ipcMain.handle('vault:status', async () => {
    return usbVaultService.getVaultState();
  });

  // List candidate/target removable drives
  ipcMain.handle('vault:listDrives', async () => {
    return usbVaultService.listTargetDrives();
  });

  // Initialize a fresh vault on a specified drive
  ipcMain.handle('vault:init', async (event, { driveLetter, shopName }) => {
    try {
      const state = await usbVaultService.initializeNewVault(driveLetter, shopName);
      return { success: true, state };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Mount a Virtual Test Vault for instantaneous live testing without physical USB
  ipcMain.handle('vault:mountVirtual', async () => {
    try {
      const state = await usbVaultService.mountVirtualTestVault();
      return { success: true, state };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 1-Click Clone to 2nd Pen Drive
  ipcMain.handle('vault:clone', async (event, { targetDrive }) => {
    try {
      const result = await usbVaultService.cloneVaultToDrive(targetDrive);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Manual Instant Lock (Panic Button / Hotkey)
  ipcMain.handle('vault:lock', async (event, { reason } = {}) => {
    try {
      await usbVaultService.unmountVault({ emergency: false, reason: reason || 'Manual user lock triggered' });
      return { success: true, status: 'LOCKED' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Get In-Memory Logs for diagnostics (Zero PC Footprint)
  ipcMain.handle('vault:logs', async () => {
    return logger.getRecentLogs(200);
  });
}

module.exports = { registerVaultIpc };
