const { paymentService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'payment:create',
    handler: async (event, data = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'payment.create');
      return paymentService.create(data, userId);
    }
  },
  {
    channel: 'payment:search',
    handler: async (event, query = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'payment.view');
      return paymentService.search(query);
    }
  },
  {
    channel: 'payment:getForBill',
    handler: async (event, { billId } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'payment.view');
      return paymentService.getForBill(billId);
    }
  }
];

module.exports = handlers;
