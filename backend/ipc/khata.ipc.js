const { khataService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'khata:getCustomerKhata',
    handler: async (event, { customerId } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.view');
      return khataService.getCustomerKhata(customerId);
    }
  },
  {
    channel: 'khata:getCurrentBalance',
    handler: async (event, { customerId } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.view');
      return khataService.getCurrentBalance(customerId);
    }
  },
  {
    channel: 'khata:getOutstanding',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.view');
      return khataService.getOutstandingCustomers();
    }
  },
  {
    channel: 'khata:getAllWithBalance',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.view');
      return khataService.getAllCustomersWithBalance();
    }
  },
  {
    channel: 'khata:search',
    handler: async (event, query) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.view');
      return khataService.search(query || {});
    }
  },
  {
    channel: 'khata:recordOpeningBalance',
    handler: async (event, { customerId, amount, notes } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.adjust');
      return khataService.recordOpeningBalance(customerId, amount, userId, notes);
    }
  },
  {
    channel: 'khata:recordDeposit',
    handler: async (event, { customerId, amount, notes } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.adjust');
      return khataService.recordDeposit(customerId, amount, userId, notes);
    }
  },
  {
    channel: 'khata:reduceDeposit',
    handler: async (event, { customerId, amount, notes, reason } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.adjust');
      return khataService.reduceDeposit(customerId, amount, userId, notes, reason);
    }
  },
  {
    channel: 'khata:adjust',
    handler: async (event, { customerId, data } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.adjust');
      return khataService.adjust(customerId, data, userId);
    }
  },
  {
    channel: 'khata:deleteTransaction',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.adjust');
      return khataService.deleteTransaction(id, userId);
    }
  },
  {
    channel: 'khata:updateTransaction',
    handler: async (event, { id, data } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.adjust');
      return khataService.updateTransaction(id, data, userId);
    }
  }
];

module.exports = handlers;
