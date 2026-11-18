const BaseRepository = require('./base_repository');
const { parsePagination, parseSort, buildMeta, buildOrderClause } = require('../utils/pagination');
const { validateSearch } = require('../validation');
const { VALID_PRODUCT_SORT_COLUMNS } = require('../validation/schemas');

class ProductRepository extends BaseRepository {
  constructor() {
    super('products');
  }

  search(query = {}) {
    const { page, pageSize } = parsePagination(query);
    const { sortColumn, sortDirection } = parseSort(query, VALID_PRODUCT_SORT_COLUMNS, 'product_name');
    const db = this.getDb();

    const conditions = ["is_deleted = 0"];
    const params = [];

    if (query.search) {
      const term = validateSearch(query.search);
      if (term) {
        conditions.push("product_name LIKE ?");
        params.push(`%${term}%`);
      }
    }

    if (query.category_id) {
      conditions.push("category_id = ?");
      params.push(parseInt(query.category_id, 10));
    }

    if (query.product_type_id) {
      conditions.push("product_type_id = ?");
      params.push(parseInt(query.product_type_id, 10));
    }

    if (query.is_active !== undefined) {
      conditions.push("is_active = ?");
      params.push(query.is_active ? 1 : 0);
    }

    if (query.supplier_id) {
      conditions.push("supplier_id = ?");
      params.push(parseInt(query.supplier_id, 10));
    }

    if (query.metal) {
      conditions.push("metal = ?");
      params.push(query.metal);
    }

    if (query.in_stock) {
      conditions.push("COALESCE(quantity_in_stock, 0) > 0");
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = buildOrderClause(sortColumn, sortDirection);

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`;
    const total = db.prepare(countSql).get(...params).count;

    const dataSql = `SELECT p.*, c.name as category_name, pt.name as product_type_name
      FROM ${this.tableName} p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_types pt ON pt.id = p.product_type_id
      WHERE ${whereClause} ${orderClause} LIMIT ? OFFSET ?`;
    const data = db.prepare(dataSql).all(...params, pageSize, (page - 1) * pageSize);

    return { data, pagination: buildMeta(total, page, pageSize) };
  }

  findLowStock(threshold = 5) {
    return this.findAll({
      whereRaw: "quantity_in_stock <= ? AND is_active = 1 AND is_deleted = 0",
      params: [threshold],
      orderBy: 'quantity_in_stock ASC'
    });
  }

  updateStock(productId, newQuantity) {
    return this.update(productId, {
      quantity_in_stock: newQuantity,
      updated_at: new Date().toISOString()
    });
  }
}

module.exports = new ProductRepository();
