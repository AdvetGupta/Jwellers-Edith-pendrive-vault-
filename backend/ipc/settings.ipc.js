const { settingsService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'settings:get',
    handler: async (event) => {
      return settingsService.getShopSettings();
    }
  },
  {
    channel: 'settings:update',
    handler: async (event, data) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'settings.edit');
      return settingsService.updateShopSettings(data, userId);
    }
  },
  {
    channel: 'settings:getAppSettings',
    handler: async () => {
      return settingsService.getAppSettings();
    }
  },
  {
    channel: 'settings:getInvoiceConfig',
    handler: async () => {
      return settingsService.getInvoiceConfig();
    }
  },
  {
    channel: 'settings:updateAppSettings',
    handler: async (event, data) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'settings.edit');
      return settingsService.updateAppSettings(data, userId);
    }
  },
  {
    channel: 'settings:checkSetup',
    handler: async () => {
      return { setupComplete: settingsService.isSetupComplete() };
    }
  },
  {
    channel: 'settings:completeSetup',
    handler: async (event, data) => {
      const userId = getUserIdFromEvent(event);
      return settingsService.completeSetup(data, userId);
    }
  }
];

module.exports = handlers;
