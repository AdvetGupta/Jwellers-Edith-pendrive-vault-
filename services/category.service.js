const { getDb } = require('../database/connection');

class CategoryService {
  getAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
  }
}

module.exports = new CategoryService();