const { getDb } = require('../database/connection');

class ProductTypeService {
  getAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM product_types ORDER BY sort_order ASC, name ASC').all();
  }
}

module.exports = new ProductTypeService();