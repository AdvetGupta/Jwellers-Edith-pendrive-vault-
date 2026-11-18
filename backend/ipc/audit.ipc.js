const { auditService } = require('../../services');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'audit:search',
    handler: async (event, query) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'activity.view');
      return auditService.search(query || {});
    }
  },
  {
    channel: 'audit:getRecent',
    handler: async (event, { limit } = {}) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'activity.view');
      return auditService.getRecent(limit || 20);
    }
  }
];

module.exports = handlers;
