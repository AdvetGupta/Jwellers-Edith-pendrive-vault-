const { inventoryService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'inventory:getMovements',
    handler: async (event, { productId } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'inventory.view');
      return inventoryService.getMovements(productId);
    }
  },
  {
    channel: 'inventory:getStockHistory',
    handler: async (event, { productId } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'inventory.view');
      return inventoryService.getStockHistory(productId);
    }
  },
  {
    channel: 'inventory:adjust',
    handler: async (event, { productId, data } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'inventory.adjust');
      return inventoryService.adjustStock(productId, data, userId);
    }
  }
];

module.exports = handlers;