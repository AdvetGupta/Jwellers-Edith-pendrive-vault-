const crypto = require('crypto');

const sessions = new Map();
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    token,
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    roleId: user.role_id,
    roleName: user.role_name || null,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_TIMEOUT_MS
  };
  sessions.set(token, session);
  return session;
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  sessions.delete(token);
}

function getCurrentUserId(token) {
  const session = getSession(token);
  return session ? session.userId : null;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

setInterval(cleanupExpiredSessions, 60000);

module.exports = { createSession, getSession, destroySession, getCurrentUserId };
