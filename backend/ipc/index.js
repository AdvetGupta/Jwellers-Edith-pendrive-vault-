const { AppError, ERROR_CODES } = require('../../errors/app-error');
const logger = require('../../logging/logger');
const { getCurrentUserId } = require('../../security/session');
const { success, successPaginated } = require('../../utils/response');

let handlers = [];

function wrapHandler(handler) {
  return async (event, ...args) => {
    try {
      const data = args[0] || {};
      if (data && data._token) {
        event.__token = data._token;
        delete data._token;
      }
      const result = await handler(event, ...args);
      return success(result);
    } catch (err) {
      if (err instanceof AppError) {
        logger.warn(`IPC error: ${err.toLog()}`);
        return err.toResponse();
      }
      logger.error(`Unhandled IPC error`, { error: err.message, stack: err.stack });
      return {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'An unexpected error occurred'
        }
      };
    }
  };
}

function registerIpcHandler(channel, handler) {
  handlers.push({ channel, handler: wrapHandler(handler) });
}

function getUserIdFromEvent(event) {
  const token = event && (event.__token || (event.sender && event.sender.token) || event.token);
  return getCurrentUserId(token);
}

function registerAllIpcHandlers() {
  const { ipcMain } = require('electron');

  const authIpc = require('./auth.ipc');
  const adminIpc = require('./admin.ipc');
  const staffIpc = require('./staff.ipc');
  const customerIpc = require('./customer.ipc');
  const settingsIpc = require('./settings.ipc');
  const khataIpc = require('./khata.ipc');
  const backupIpc = require('./backup.ipc');
  const permissionIpc = require('./permission.ipc');
  const auditIpc = require('./audit.ipc');
  const utilsIpc = require('./utils.ipc');
  const membershipIpc = require('./membership.ipc');
  const productIpc = require('./product.ipc');
  const inventoryIpc = require('./inventory.ipc');
  const categoryIpc = require('./category.ipc');
  const productTypeIpc = require('./productType.ipc');
  const paymentIpc = require('./payment.ipc');
  const billIpc = require('./bill.ipc');
  const communicationIpc = require('./communication.ipc');
  const reportIpc = require('./report.ipc');
  const girviIpc = require('./girvi.ipc');
  const { registerVaultIpc } = require('./vault.ipc');

  // Register dedicated Hardware Vault IPC handlers
  registerVaultIpc();

  const allHandlers = [
    ...authIpc,
    ...adminIpc,
    ...staffIpc,
    ...customerIpc,
    ...settingsIpc,
    ...khataIpc,
    ...backupIpc,
    ...permissionIpc,
    ...auditIpc,
    ...utilsIpc,
    ...membershipIpc,
    ...productIpc,
    ...inventoryIpc,
    ...categoryIpc,
    ...productTypeIpc,
    ...paymentIpc,
    ...billIpc,
    ...communicationIpc,
    ...reportIpc,
    ...girviIpc
  ];

  for (const { channel, handler } of allHandlers) {
    if (ipcMain && typeof ipcMain.handle === 'function') {
      ipcMain.handle(channel, wrapHandler(handler));
    }
    handlers.push({ channel, handler });
  }

  logger.info(`Registered ${allHandlers.length} IPC handlers`);
}

module.exports = { registerAllIpcHandlers, registerIpcHandler, getUserIdFromEvent, handlers };
