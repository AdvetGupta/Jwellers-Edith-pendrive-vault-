const { backupService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'backup:create',
    handler: async (event, { backupDir } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'backup.create');
      return backupService.createLocalBackup(userId, backupDir);
    }
  },
  {
    channel: 'backup:verify',
    handler: async (event, { backupPath } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'backup.create');
      return backupService.verifyBackup(backupPath);
    }
  },
  {
    channel: 'backup:list',
    handler: async (event, options) => {
      return backupService.listBackups(options || {});
    }
  },
  {
    channel: 'backup:restore',
    handler: async (event, { backupPath } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'backup.restore');
      return backupService.restoreBackup(backupPath, userId);
    }
  },
  {
    channel: 'backup:update',
    handler: async (event, { backupPath } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'backup.create');
      return backupService.updateBackup(userId, backupPath);
    }
  },
  {
    channel: 'backup:delete',
    handler: async (event, { id, backupPath } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'backup.create');
      return backupService.deleteBackup(userId, id, backupPath);
    }
  }
];

module.exports = handlers;
