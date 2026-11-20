const { ipcMain, shell } = require('electron');
const updaterService = require('../../services/updater.service');

function registerUpdaterIpc() {
  ipcMain.handle('updater:check', async () => {
    return updaterService.checkForUpdates();
  });

  ipcMain.handle('updater:openRelease', async (event, url) => {
    if (url && (url.startsWith('https://github.com') || url.startsWith('http'))) {
      shell.openExternal(url);
      return { success: true };
    }
    return { success: false };
  });
}

module.exports = { registerUpdaterIpc };
