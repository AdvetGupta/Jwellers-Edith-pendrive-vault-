const { getDb } = require('../database/connection');

class MembershipService {
  getAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM membership_levels ORDER BY sort_order ASC').all();
  }
}

module.exports = new MembershipService();