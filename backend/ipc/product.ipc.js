const { productService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'product:search',
    handler: async (event, query) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'product.view');
      return productService.search(query || {});
    }
  },
  {
    channel: 'product:getById',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'product.view');
      return productService.getById(id);
    }
  },
  {
    channel: 'product:create',
    handler: async (event, data) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'product.create');
      return productService.create(data, userId);
    }
  },
  {
    channel: 'product:update',
    handler: async (event, { id, data } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'product.edit');
      return productService.update(id, data, userId);
    }
  },
  {
    channel: 'product:delete',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'product.delete');
      return productService.softDelete(id, userId);
    }
  },
  {
    channel: 'product:getLowStock',
    handler: async (event, { threshold } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'inventory.view');
      return productService.getLowStock(threshold);
    }
  }
];

module.exports = handlers;