const communicationService = require('../../services/communication.service');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'communication:send',
    handler: async (event, args) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'communication.send');
      return communicationService.send(userId, args);
    }
  },
  {
    channel: 'communication:history',
    handler: async (event, customerId) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.view');
      return communicationService.getHistory(customerId);
    }
  },
  {
    channel: 'communication:search',
    handler: async (event, query) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'khata.view');
      return communicationService.search(query || {});
    }
  }
];

module.exports = handlers;
