const { AppError, ERROR_CODES } = require('../errors/app-error');
const { hashPassword, verifyPassword } = require('../security/password');
const { createSession, getSession, destroySession, getCurrentUserId } = require('../security/session');
const { userRepository } = require('../repositories');
const { getDb } = require('../database/connection');
const { validateString, validateOptionalString } = require('../validation');
const audit = require('../logging/audit');
const logger = require('../logging/logger');

class AuthService {
  async login(username, password) {
    if (!username || !password) {
      throw AppError.validation('Username and password are required');
    }

    const user = userRepository.findByUsername(username);
    if (!user) {
      audit.log(null, 'LOGIN_FAILED', 'user', null, `Failed login attempt for username: ${username}`);
      throw AppError.authentication('Invalid username or password');
    }

    if (!user.is_active) {
      audit.log(user.id, 'LOGIN_FAILED', 'user', user.id, 'Account is inactive');
      throw AppError.authentication('Account is inactive. Contact the owner.');
    }

    try {
      if (!verifyPassword(password, user.password_hash)) {
        audit.log(user.id, 'LOGIN_FAILED', 'user', user.id, 'Invalid password');
        throw AppError.authentication('Invalid username or password');
      }
    } catch (err) {
      if (err.code === ERROR_CODES.AUTHENTICATION_ERROR) throw err;
      throw AppError.authentication('Invalid username or password');
    }

    const roleName = getDb().prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id)?.name;

    userRepository.updateLastLogin(user.id);
    const session = createSession({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role_id: user.role_id,
      role_name: roleName
    });

    audit.log(user.id, 'LOGIN_SUCCESS', 'user', user.id, `User ${user.username} logged in`);

    return {
      token: session.token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        roleId: user.role_id,
        roleName: roleName,
        phone: user.phone
      }
    };
  }

  logout(token) {
    const session = getSession(token);
    if (session) {
      audit.log(session.userId, 'LOGOUT', 'user', session.userId, `User ${session.username} logged out`);
    }
    destroySession(token);
    return { loggedOut: true };
  }

  getCurrentUser(token) {
    if (!token) return null;
    const session = getSession(token);
    if (!session) return null;
    return {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      roleId: session.roleId,
      roleName: session.roleName
    };
  }

  validateSession(token) {
    if (!token) return false;
    return getSession(token) !== null;
  }

  getUserId(token) {
    return getCurrentUserId(token);
  }

  createFirstOwner({ displayName, username, password, phone, referenceCode }) {
    const db = getDb();
    const ownerRole = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get();
    if (!ownerRole) throw AppError.notFound('Owner role');

    const existingOwners = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(ownerRole.id);
    if (existingOwners.count > 0) {
      throw AppError.conflict('An owner account already exists');
    }

    const name = validateString(displayName, 'Display name');
    const uname = validateString(username, 'Username', 50).toLowerCase().trim();
    const pw = validateString(password, 'Password', 128);

    if (pw.length < 6) {
      throw AppError.validation('Password must be at least 6 characters');
    }

    const dupUser = userRepository.findByUsername(uname);
    if (dupUser) {
      throw AppError.conflict(`Username '${uname}' is already taken`);
    }

    const hash = hashPassword(pw);
    const result = userRepository.create({
      username: uname,
      password_hash: hash,
      display_name: name,
      role_id: ownerRole.id,
      phone: phone || null,
      is_active: 1
    });

    audit.log(result.id, 'OWNER_CREATED', 'user', result.id, `Owner account created for ${name} (${uname})`);

    return { id: result.id, username: uname, displayName: name };
  }

  changePassword(userId, currentPassword, newPassword) {
    const user = userRepository.findById(userId);
    if (!user) throw AppError.notFound('User');

    if (!verifyPassword(currentPassword, user.password_hash)) {
      throw AppError.validation('Current password is incorrect');
    }

    if (!newPassword || newPassword.length < 6) {
      throw AppError.validation('New password must be at least 6 characters');
    }

    if (currentPassword === newPassword) {
      throw AppError.validation('New password must be different from current password');
    }

    const hash = hashPassword(newPassword);
    userRepository.updatePassword(userId, hash);
    audit.log(userId, 'PASSWORD_CHANGED', 'user', userId, 'Password changed');
    return { changed: true };
  }
}

module.exports = new AuthService();
