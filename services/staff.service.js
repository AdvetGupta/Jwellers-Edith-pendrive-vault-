const { AppError } = require('../errors/app-error');
const { hashPassword } = require('../security/password');
const { validateString, validateOptionalString } = require('../validation');
const { userRepository } = require('../repositories');
const { getDb } = require('../database/connection');
const audit = require('../logging/audit');

class StaffService {
  list(query = {}) {
    const db = getDb();
    const activeFilter = query.active_only ? 'AND u.is_active = 1' : '';
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.phone, u.is_active, u.created_at, u.last_login_at,
             r.name as role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'staff' ${activeFilter}
      ORDER BY u.display_name ASC
    `).all();
  }

  getById(id) {
    const user = userRepository.findById(id);
    if (!user) throw AppError.notFound('Staff');
    const role = getDb().prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
    if (!role || role.name !== 'staff') throw AppError.notFound('Staff');
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      phone: user.phone,
      isActive: !!user.is_active,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    };
  }

  create(data, actorUserId) {
    const displayName = validateString(data.displayName || data.display_name, 'Display name');
    const username = validateString(data.username, 'Username', 50).toLowerCase().trim();
    const password = validateString(data.password, 'Password', 128);
    const phone = validateOptionalString(data.phone, 20);

    if (password.length < 6) {
      throw AppError.validation('Password must be at least 6 characters');
    }

    const existing = userRepository.findByUsername(username);
    if (existing) {
      throw AppError.conflict(`Username '${username}' is already taken`);
    }

    const staffRoleId = getDb().prepare("SELECT id FROM roles WHERE name = 'staff'").get()?.id;
    if (!staffRoleId) throw AppError.notFound('Staff role');

    const hash = hashPassword(password);
    const result = userRepository.create({
      username,
      password_hash: hash,
      display_name: displayName,
      role_id: staffRoleId,
      phone: phone || null,
      is_active: 1
    });

    const newUser = userRepository.findById(result.id);
    audit.log(actorUserId, 'STAFF_CREATED', 'user', result.id, `Created staff account '${username}' (${displayName})`);
    return { id: result.id, username, displayName };
  }

  update(id, data, actorUserId) {
    const user = userRepository.findById(id);
    if (!user) throw AppError.notFound('Staff');

    const role = getDb().prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
    if (!role || role.name !== 'staff') throw AppError.notFound('Staff');

    const updates = {};
    if (data.displayName !== undefined) {
      updates.display_name = validateString(data.displayName, 'Display name');
    }
    if (data.display_name !== undefined) {
      updates.display_name = validateString(data.display_name, 'Display name');
    }
    if (data.username !== undefined) {
      const username = validateString(data.username, 'Username', 50).toLowerCase().trim();
      const dup = userRepository.findByUsername(username);
      if (dup && dup.id !== id) {
        throw AppError.conflict(`Username '${username}' is already taken`);
      }
      updates.username = username;
    }
    if (data.phone !== undefined) {
      updates.phone = validateOptionalString(data.phone, 20) || null;
    }

    if (Object.keys(updates).length === 0) {
      return { updated: false };
    }

    updates.updated_at = new Date().toISOString();
    userRepository.update(id, updates);
    audit.log(actorUserId, 'STAFF_UPDATED', 'user', id, `Updated staff account '${user.username}'`);
    return { updated: true, id };
  }

  setActive(id, active, actorUserId) {
    const user = userRepository.findById(id);
    if (!user) throw AppError.notFound('Staff');

    const role = getDb().prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
    if (!role || role.name !== 'staff') throw AppError.notFound('Staff');

    userRepository.update(id, { is_active: active ? 1 : 0, updated_at: new Date().toISOString() });
    const action = active ? 'STAFF_REACTIVATED' : 'STAFF_DEACTIVATED';
    audit.log(actorUserId, action, 'user', id, `${active ? 'Activated' : 'Deactivated'} staff '${user.username}'`);
    return { active };
  }

  resetPassword(id, newPassword, actorUserId) {
    const user = userRepository.findById(id);
    if (!user) throw AppError.notFound('Staff');

    const role = getDb().prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
    if (!role || role.name !== 'staff') throw AppError.notFound('Staff');

    if (!newPassword || newPassword.length < 6) {
      throw AppError.validation('Password must be at least 6 characters');
    }

    const hash = hashPassword(newPassword);
    userRepository.updatePassword(id, hash);
    audit.log(actorUserId, 'PASSWORD_RESET', 'user', id, `Password reset for staff '${user.username}'`);
    return { reset: true };
  }

  _protectLastOwner() {
    const db = getDb();
    const ownerRole = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get();
    if (!ownerRole) return;
    const activeOwners = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ? AND is_active = 1').get(ownerRole.id);
    if (activeOwners.count <= 1) {
      throw AppError.invalidOperation('Cannot deactivate the last active owner account');
    }
  }
}

module.exports = new StaffService();
