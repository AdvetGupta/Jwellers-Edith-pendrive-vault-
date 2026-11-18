const BackupManager = require('../database/backup_manager');
const { AppError } = require('../errors/app-error');
const { validateString, validateId } = require('../validation');
const audit = require('../logging/audit');
const logger = require('../logging/logger');

class BackupService {
  constructor() {
    this.manager = new BackupManager();
  }

  createLocalBackup(userId, backupDir = null) {
    try {
      if (backupDir) {
        const dir = validateString(backupDir, 'Backup directory', 500);
        this.manager.setBackupDir(dir);
      }

      const result = this.manager.createBackup({ userId, backupType: 'local' });

      audit.log(userId, 'BACKUP_CREATED', 'backup_history', null,
        `Local backup created: ${result.fileName} (${Math.round(result.fileSize / 1024)} KB)`);

      return result;
    } catch (err) {
      logger.error('Backup creation failed', { error: err.message, userId });
      throw AppError.backup('Failed to create backup: ' + err.message);
    }
  }

  verifyBackup(backupPath) {
    try {
      const path = validateString(backupPath, 'Backup path', 500);
      const result = this.manager.verifyBackup(path);
      return result;
    } catch (err) {
      throw AppError.backup('Backup verification failed: ' + err.message);
    }
  }

  restoreBackup(backupPath, userId) {
    const path = validateString(backupPath, 'Backup path', 500);

    if (!require('fs').existsSync(path)) {
      throw AppError.file('Backup file not found: ' + path);
    }

    const verification = this.manager.verifyBackup(path);
    if (!verification.valid) {
      throw AppError.backup('Backup verification failed: ' + verification.error);
    }

    try {
      const fs = require('fs');
      const connection = require('../database/connection');
      const sourcePath = connection.getPath();

      connection.close();

      fs.copyFileSync(path, sourcePath);

      const db = connection.open(sourcePath);

      audit.log(userId, 'RESTORE_COMPLETED', 'backup_history', null,
        `Restored from backup: ${path}`);

      return { success: true, message: 'Backup restored successfully' };
    } catch (err) {
      logger.error('Backup restore failed', { error: err.message, path });
      throw AppError.backup('Restore failed: ' + err.message);
    }
  }

  listBackups(options = {}) {
    return this.manager.listBackups(options);
  }

  updateBackup(userId, backupPath) {
    try {
      const path = validateString(backupPath, 'Backup path', 500);
      const fs = require('fs');
      if (!fs.existsSync(path)) {
        throw AppError.file('Backup file not found: ' + path);
      }
      const folder = require('path').dirname(path);
      const fileName = require('path').basename(path);
      
      const result = this.manager.createBackup({
        userId,
        backupDir: require('path').dirname(folder),
        folderName: require('path').basename(folder),
        fileName: fileName,
        isUpdate: true
      });
      
      audit.log(userId, 'BACKUP_UPDATED', 'backup_history', null,
        `Backup updated: ${result.fileName}`);
      return result;
    } catch (err) {
      logger.error('Backup update failed', { error: err.message, backupPath });
      throw AppError.backup('Failed to update backup: ' + err.message);
    }
  }

  deleteBackup(userId, id, backupPath) {
    try {
      const backupId = validateId(id, 'Backup ID');
      const path = validateString(backupPath, 'Backup path', 500);
      const fs = require('fs');
      
      // Delete from disk if exists
      if (fs.existsSync(path)) {
        const folder = require('path').dirname(path);
        const parentDir = require('path').dirname(folder);
        const folderName = require('path').basename(folder);
        // Safety check: only delete folders starting with "jwellers_edith_backup_"
        if (folderName.startsWith('jwellers_edith_backup_') && folder !== parentDir) {
          fs.rmSync(folder, { recursive: true, force: true });
          logger.info(`Deleted backup folder from disk: ${folder}`);
        } else {
          // Fallback: just delete the database file if it's outside our standard folder format
          fs.unlinkSync(path);
          logger.info(`Deleted backup file from disk: ${path}`);
        }
      }

      // Delete from database history
      const { getDb } = require('../database/connection');
      const db = getDb();
      db.prepare('DELETE FROM backup_history WHERE id = ?').run(backupId);
      
      audit.log(userId, 'BACKUP_DELETED', 'backup_history', backupId, `Backup ID ${backupId} deleted`);
      return { success: true, message: 'Backup deleted successfully' };
    } catch (err) {
      logger.error('Backup deletion failed', { error: err.message, id, backupPath });
      throw AppError.backup('Failed to delete backup: ' + err.message);
    }
  }
}

module.exports = new BackupService();
