const { getDb } = require('../database/connection');
const { AppError } = require('../errors/app-error');

function hasPermission(userId, permissionCode) {
  if (!userId || !permissionCode) return false;

  const db = getDb();

  const user = db.prepare('SELECT role_id FROM users WHERE id = ? AND is_active = 1').get(userId);
  if (!user) return false;

  const ownerRoleId = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get()?.id;
  if (user.role_id === ownerRoleId) return true;

  const denied = db.prepare(`
    SELECT up.is_granted FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = ? AND p.code = ?
  `).get(userId, permissionCode);

  if (denied) {
    return denied.is_granted === 1;
  }

  const granted = db.prepare(`
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ? AND p.code = ?
  `).get(user.role_id, permissionCode);

  return !!granted;
}

function requirePermission(userId, permissionCode) {
  if (!hasPermission(userId, permissionCode)) {
    throw AppError.authorization(`Permission '${permissionCode}' required`);
  }
  return true;
}

function getUserPermissions(userId) {
  const db = getDb();
  const user = db.prepare('SELECT role_id FROM users WHERE id = ? AND is_active = 1').get(userId);
  if (!user) return [];

  const ownerRoleId = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get()?.id;
  if (user.role_id === ownerRoleId) {
    return db.prepare('SELECT code FROM permissions').all().map(p => p.code);
  }

  const rolePerms = db.prepare(`
    SELECT p.code FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `).all(user.role_id).map(p => p.code);

  const userOverrides = db.prepare(`
    SELECT p.code, up.is_granted FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = ?
  `).all(userId);

  for (const ov of userOverrides) {
    if (ov.is_granted === 1 && !rolePerms.includes(ov.code)) {
      rolePerms.push(ov.code);
    } else if (ov.is_granted === 0) {
      const idx = rolePerms.indexOf(ov.code);
      if (idx !== -1) rolePerms.splice(idx, 1);
    }
  }

  return rolePerms;
}

const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_EDIT: 'customer.edit',
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_DELETE: 'customer.delete',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_EDIT: 'product.edit',
  PRODUCT_VIEW: 'product.view',
  PRODUCT_DELETE: 'product.delete',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  BILL_CREATE: 'bill.create',
  BILL_VIEW: 'bill.view',
  BILL_CANCEL: 'bill.cancel',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_VIEW: 'payment.view',
  KHATA_VIEW: 'khata.view',
  KHATA_ADJUST: 'khata.adjust',
  REPORT_VIEW: 'report.view',
  STAFF_CREATE: 'staff.create',
  STAFF_EDIT: 'staff.edit',
  STAFF_DELETE: 'staff.delete',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',
  ACTIVITY_VIEW: 'activity.view',
  COMMUNICATION_SEND: 'communication.send'
};

module.exports = { hasPermission, requirePermission, getUserPermissions, PERMISSIONS };
