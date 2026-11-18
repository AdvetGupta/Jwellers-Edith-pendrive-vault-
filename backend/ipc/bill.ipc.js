const { billService, invoiceService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'invoice:generate',
    handler: async () => {
      return invoiceService.generateInvoiceNumber();
    }
  },
  {
    channel: 'invoice:reserve',
    handler: async () => {
      return invoiceService.reserveInvoiceNumber();
    }
  },
  {
    channel: 'bill:create',
    handler: async (event, data = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'bill.create');
      return billService.finalize(data, userId);
    }
  },
  {
    channel: 'bill:getById',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'bill.view');
      return billService.getById(id);
    }
  },
  {
    channel: 'bill:search',
    handler: async (event, query = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'bill.view');
      return billService.search(query);
    }
  },
  {
    channel: 'bill:cancel',
    handler: async (event, { id, data } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'bill.cancel');
      return billService.cancel(id, data || {}, userId);
    }
  }
];

module.exports = handlers;
