const reportService = require('../../services/report.service');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'report:dashboard',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      requirePermission(userId, 'dashboard.view');
      return reportService.getDashboardData();
    }
  }
];

module.exports = handlers;
