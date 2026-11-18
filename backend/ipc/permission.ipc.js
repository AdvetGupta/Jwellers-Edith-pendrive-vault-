const { permissionService } = require('../../services');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'permission:check',
    handler: async (event, { permissionCode } = {}) => {
      const userId = getUserIdFromEvent(event);
      return permissionService.hasPermission(userId, permissionCode);
    }
  },
  {
    channel: 'permission:getUserPermissions',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      return permissionService.getUserPermissions(userId);
    }
  },
  {
    channel: 'permission:getAll',
    handler: async () => {
      return permissionService.getAllPermissions();
    }
  },
  {
    channel: 'permission:getRolePermissions',
    handler: async (event, { roleId } = {}) => {
      return permissionService.getRolePermissions(roleId);
    }
  },
  {
    channel: 'permission:setUserPermission',
    handler: async (event, { userId, permissionId, isGranted } = {}) => {
      const actorUserId = getUserIdFromEvent(event);
      return permissionService.setUserPermission(userId, permissionId, isGranted, actorUserId);
    }
  }
];

module.exports = handlers;
