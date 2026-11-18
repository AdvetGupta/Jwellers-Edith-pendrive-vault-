const BaseRepository = require('./base_repository');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  findByUsername(username) {
    return this.findOne({ where: { username }, limit: 1 });
  }

  findByRoleId(roleId) {
    return this.findAll({ where: { role_id: roleId } });
  }

  findActive() {
    return this.findAll({ where: { is_active: 1 }, orderBy: 'display_name ASC' });
  }

  updateLastLogin(userId) {
    return this.update(userId, { last_login_at: new Date().toISOString() });
  }

  updatePassword(userId, passwordHash) {
    return this.update(userId, { password_hash: passwordHash, updated_at: new Date().toISOString() });
  }
}

module.exports = new UserRepository();
