const { authService } = require('../../services');
const { getUserIdFromEvent } = require('./index');

const handlers = [
  {
    channel: 'auth:login',
    handler: async (event, { username, password } = {}) => {
      return authService.login(username, password);
    }
  },
  {
    channel: 'auth:logout',
    handler: async (event, { token } = {}) => {
      return authService.logout(token);
    }
  },
  {
    channel: 'auth:getCurrentUser',
    handler: async (event, { token } = {}) => {
      return authService.getCurrentUser(token);
    }
  },
  {
    channel: 'auth:validateSession',
    handler: async (event, { token } = {}) => {
      return authService.validateSession(token);
    }
  },
  {
    channel: 'auth:checkSession',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      return { authenticated: !!userId, userId };
    }
  },
  {
    channel: 'auth:changePassword',
    handler: async (event, { currentPassword, newPassword } = {}) => {
      const userId = getUserIdFromEvent(event);
      return authService.changePassword(userId, currentPassword, newPassword);
    }
  }
];

module.exports = handlers;
