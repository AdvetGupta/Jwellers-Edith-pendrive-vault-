const { getDb } = require('../database/connection');
const logger = require('./logger');

const SENSITIVE_FIELDS = ['password_hash', 'password', 'aadhaar_number', 'token', 'secret'];

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const sanitized = { ...metadata };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

function log(userId, action, entityType, entityId, description, metadata = null) {
  try {
    const db = getDb();
    const safeMeta = metadata ? JSON.stringify(sanitizeMetadata(metadata)) : null;

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId || null, action, entityType || null, entityId || null, description || null, safeMeta);

    return true;
  } catch (err) {
    logger.error('Failed to write audit log', { action, error: err.message });
    return false;
  }
}

module.exports = { log };
