const crypto = require('crypto');

const HASH_ALGORITHM = 'sha256';
const HASH_ENCODING = 'hex';

function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return crypto.createHash(HASH_ALGORITHM).update(password).digest(HASH_ENCODING);
}

function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  const computedHash = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashPassword, verifyPassword, generateResetToken };
