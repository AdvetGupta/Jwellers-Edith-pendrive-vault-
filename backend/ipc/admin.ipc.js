const { getDb } = require('../../database/connection');

const handlers = [
  {
    channel: 'admin:checkOwner',
    handler: async () => {
      const db = getDb();
      const ownerRole = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get();
      if (!ownerRole) return { hasOwner: false };
      const ownerCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ? AND is_active = 1').get(ownerRole.id);
      return { hasOwner: ownerCount.count > 0 };
    }
  },
  {
    channel: 'admin:createOwner',
    handler: async (event, { displayName, username, password, phone, referenceCode } = {}) => {
      const { authService } = require('../../services');
      return authService.createFirstOwner({ displayName, username, password, phone, referenceCode });
    }
  }
];

module.exports = handlers;
