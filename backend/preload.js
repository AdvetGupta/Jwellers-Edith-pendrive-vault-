const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_CHANNELS = [
  'auth:login',
  'auth:logout',
  'auth:getCurrentUser',
  'auth:validateSession',
  'auth:changePassword',
  'auth:checkSession',

  'admin:checkOwner',
  'admin:createOwner',

  'staff:list',
  'staff:getById',
  'staff:create',
  'staff:update',
  'staff:deactivate',
  'staff:reactivate',
  'staff:resetPassword',

  'customer:search',
  'customer:getById',
  'customer:getByCustomerId',
  'customer:getSummary',
  'customer:create',
  'customer:update',
  'customer:archive',
  'customer:unarchive',
  'customer:delete',
  'customer:counts',
  'customer:verifyIntegrity',
  'customer:getNextId',
  'customer:realignQueue',

  'girvi:search',
  'girvi:getById',
  'girvi:create',
  'girvi:update',
  'girvi:delete',
  'girvi:permanentDelete',
  'girvi:recordPayment',
  'girvi:deletePayment',
  'girvi:getSummary',
  'girvi:importExcel',
  'girvi:getImportStatus',
  'girvi:undoLastImport',
  'girvi:redoLastImport',

  'settings:get',
  'settings:update',
  'settings:getAppSettings',
  'settings:getInvoiceConfig',
  'settings:checkSetup',
  'settings:completeSetup',
  'settings:updateAppSettings',

  'invoice:generate',

  'khata:getCustomerKhata',
  'khata:getCurrentBalance',
  'khata:getOutstanding',
  'khata:getAllWithBalance',
  'khata:search',
  'khata:recordOpeningBalance',
  'khata:recordDeposit',
  'khata:reduceDeposit',
  'khata:adjust',
  'khata:deleteTransaction',
  'khata:updateTransaction',

  'backup:create',
  'backup:verify',
  'backup:list',
  'backup:restore',
  'backup:update',
  'backup:delete',

  'permission:check',
  'permission:getUserPermissions',
  'permission:getAll',
  'permission:getRolePermissions',
  'permission:setUserPermission',

  'audit:search',
  'audit:getRecent',

  'utils:echo',
  'utils:openExternal',
  'membership:list',

  'product:search',
  'product:getById',
  'product:create',
  'product:update',
  'product:delete',
  'product:getLowStock',

  'inventory:getMovements',
  'inventory:getStockHistory',
  'inventory:adjust',

  'category:list',
  'productType:list',

  'invoice:reserve',

  'bill:create',
  'bill:getById',
  'bill:search',
  'bill:cancel',

  'payment:create',
  'payment:search',
  'payment:getForBill',

  'communication:send',
  'communication:history',
  'communication:search',

  'report:dashboard',

  // Hardware USB Vault Channels
  'vault:status',
  'vault:listDrives',
  'vault:init',
  'vault:mountVirtual',
  'vault:clone',
  'vault:lock',
  'vault:logs'
];

const ALLOWED_EVENTS = [
  'vault:statusChange',
  'vault:connected',
  'vault:disconnected'
];

function validateChannel(channel) {
  if (!ALLOWED_CHANNELS.includes(channel) && !ALLOWED_EVENTS.includes(channel)) {
    throw new Error(`IPC channel '${channel}' is not allowed`);
  }
}

contextBridge.exposeInMainWorld('jwellersEdith', {
  invoke: async (channel, ...args) => {
    validateChannel(channel);
    return ipcRenderer.invoke(channel, ...args);
  },

  on: (channel, callback) => {
    validateChannel(channel);
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  platform: process.platform
});
