const { getDb } = require('../database/connection');
const { AppError } = require('../errors/app-error');
const { hasPermission, requirePermission, getUserPermissions } = require('../security/permission');
const audit = require('../logging/audit');

class PermissionService {
  hasPermission(userId, permissionCode) {
    return hasPermission(userId, permissionCode);
  }

  requirePermission(userId, permissionCode) {
    return requirePermission(userId, permissionCode);
  }

  getUserPermissions(userId) {
    return getUserPermissions(userId);
  }

  getAllPermissions() {
    const db = getDb();
    return db.prepare('SELECT * FROM permissions ORDER BY module, name').all();
  }

  getRolePermissions(roleId) {
    const db = getDb();
    return db.prepare(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.name
    `).all(roleId);
  }

  setRolePermission(roleId, permissionId, granted, userId) {
    const db = getDb();
    const permission = db.prepare('SELECT code, name FROM permissions WHERE id = ?').get(permissionId);
    if (!permission) throw AppError.notFound('Permission');

    if (granted) {
      db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(roleId, permissionId);
    } else {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?').run(roleId, permissionId);
    }

    audit.log(userId, 'PERMISSION_CHANGED', 'role_permissions', null,
      `${granted ? 'Granted' : 'Revoked'} permission '${permission.name}' to role ${roleId}`);

    return { updated: true };
  }

  setUserPermission(userId, permissionId, isGranted, actorUserId) {
    const db = getDb();
    const permission = db.prepare('SELECT code, name FROM permissions WHERE id = ?').get(permissionId);
    if (!permission) throw AppError.notFound('Permission');

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
    if (!user) throw AppError.notFound('User');

    const existing = db.prepare('SELECT id FROM user_permissions WHERE user_id = ? AND permission_id = ?').get(userId, permissionId);

    if (existing) {
      db.prepare('UPDATE user_permissions SET is_granted = ? WHERE id = ?').run(isGranted ? 1 : 0, existing.id);
    } else {
      db.prepare('INSERT INTO user_permissions (user_id, permission_id, is_granted) VALUES (?, ?, ?)').run(userId, permissionId, isGranted ? 1 : 0);
    }

    audit.log(actorUserId, 'USER_PERMISSION_CHANGED', 'user_permissions', null,
      `${isGranted ? 'Granted' : 'Denied'} permission '${permission.name}' for user ${user.username}`);

    return { updated: true };
  }
}

module.exports = new PermissionService();
