const { customerService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'customer:search',
    handler: async (event, query) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.view');
      return customerService.search(query || {});
    }
  },
  {
    channel: 'customer:getById',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.view');
      return customerService.getById(id);
    }
  },
  {
    channel: 'customer:getByCustomerId',
    handler: async (event, { customerId } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.view');
      return customerService.getByCustomerId(customerId);
    }
  },
  {
    channel: 'customer:getSummary',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.view');
      return customerService.getSummary(id);
    }
  },
  {
    channel: 'customer:create',
    handler: async (event, data) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.create');
      return customerService.create(data, userId);
    }
  },
  {
    channel: 'customer:update',
    handler: async (event, { id, data } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.edit');
      return customerService.update(id, data, userId);
    }
  },
  {
    channel: 'customer:archive',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.edit');
      return customerService.archive(id, userId);
    }
  },
  {
    channel: 'customer:unarchive',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.edit');
      return customerService.unarchive(id, userId);
    }
  },
  {
    channel: 'customer:delete',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.delete');
      return customerService.softDelete(id, userId);
    }
  },
  {
    channel: 'customer:counts',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.view');
      return customerService.getCounts();
    }
  },
  {
    channel: 'customer:verifyIntegrity',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.view');
      return customerService.verifyIntegrity();
    }
  },
  {
    channel: 'customer:getNextId',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.view');
      return customerService.getNextId();
    }
  },
  {
    channel: 'customer:realignQueue',
    handler: async (event, { sortBy } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'customer.edit');
      return customerService.realignQueue(userId, sortBy);
    }
  }
];

module.exports = handlers;
