const { staffService } = require('../../services');
const { getUserIdFromEvent } = require('./index');
const { requirePermission } = require('../../security/permission');

function requireStaffManage(userId) {
  requirePermission(userId, 'staff.create');
}

const handlers = [
  {
    channel: 'staff:list',
    handler: async (event, query = {}) => {
      const userId = getUserIdFromEvent(event);
      requireStaffManage(userId);
      return staffService.list(query);
    }
  },
  {
    channel: 'staff:getById',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requireStaffManage(userId);
      return staffService.getById(id);
    }
  },
  {
    channel: 'staff:create',
    handler: async (event, data = {}) => {
      const userId = getUserIdFromEvent(event);
      requireStaffManage(userId);
      return staffService.create(data, userId);
    }
  },
  {
    channel: 'staff:update',
    handler: async (event, { id, ...data } = {}) => {
      const userId = getUserIdFromEvent(event);
      requireStaffManage(userId);
      return staffService.update(id, data, userId);
    }
  },
  {
    channel: 'staff:deactivate',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requireStaffManage(userId);
      return staffService.setActive(id, false, userId);
    }
  },
  {
    channel: 'staff:reactivate',
    handler: async (event, { id } = {}) => {
      const userId = getUserIdFromEvent(event);
      requireStaffManage(userId);
      return staffService.setActive(id, true, userId);
    }
  },
  {
    channel: 'staff:resetPassword',
    handler: async (event, { id, newPassword } = {}) => {
      const userId = getUserIdFromEvent(event);
      requireStaffManage(userId);
      return staffService.resetPassword(id, newPassword, userId);
    }
  }
];

module.exports = handlers;
