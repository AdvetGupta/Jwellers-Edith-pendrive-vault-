const BaseRepository = require('./base_repository');
const { parsePagination, parseSort, buildMeta, buildOrderClause } = require('../utils/pagination');
const { VALID_KHATA_SORT_COLUMNS } = require('../validation/schemas');

class KhataRepository extends BaseRepository {
  constructor() {
    super('khata_transactions');
  }

  search(query = {}) {
    const { page, pageSize } = parsePagination(query);
    const { sortColumn, sortDirection } = parseSort(query, VALID_KHATA_SORT_COLUMNS, 'created_at');
    const db = this.getDb();

    const conditions = [];
    const params = [];

    if (query.customer_id) {
      conditions.push("k.customer_id = ?");
      params.push(parseInt(query.customer_id, 10));
    }

    if (query.transaction_type) {
      conditions.push("k.transaction_type = ?");
      params.push(query.transaction_type);
    }

    if (query.date_from) {
      conditions.push("k.transaction_date >= ?");
      params.push(query.date_from);
    }

    if (query.date_to) {
      conditions.push("k.transaction_date <= ?");
      params.push(query.date_to);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderClause = buildOrderClause(sortColumn, sortDirection, 'k');

    const countSql = `SELECT COUNT(*) as count FROM khata_transactions k ${whereClause}`;
    const total = db.prepare(countSql).get(...params).count;

    const dataSql = `
      SELECT k.*, c.name as customer_name, u.display_name as user_name
      FROM khata_transactions k
      LEFT JOIN customers c ON c.id = k.customer_id
      LEFT JOIN users u ON u.id = k.user_id
      ${whereClause}
      ${orderClause} LIMIT ? OFFSET ?`;
    const data = db.prepare(dataSql).all(...params, pageSize, (page - 1) * pageSize);

    return { data, pagination: buildMeta(total, page, pageSize) };
  }

  getCustomerKhata(customerId) {
    return this.findAll({
      where: { customer_id: customerId },
      orderBy: 'id ASC'
    });
  }

  getCurrentBalance(customerId) {
    const db = this.getDb();
    const row = db.prepare(`
      SELECT COALESCE(balance, 0) as balance
      FROM khata_transactions
      WHERE customer_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(customerId);
    return row ? row.balance : 0;
  }

  getOutstandingCustomers() {
    const db = this.getDb();
    return db.prepare(`
      SELECT k.customer_id, c.customer_id as cust_code, c.name as customer_name, c.relation, c.phone1, c.city, c.address, k.balance
      FROM khata_transactions k
      JOIN customers c ON c.id = k.customer_id
      WHERE k.id IN (
        SELECT MAX(id) FROM khata_transactions GROUP BY customer_id
      )
      AND k.balance > 0
      AND c.is_deleted = 0 AND (c.notes IS NULL OR c.notes NOT LIKE 'Created via Girvi%')
      ORDER BY k.balance DESC
    `).all();
  }

  getAllCustomersWithBalance() {
    const db = this.getDb();
    return db.prepare(`
      SELECT c.id as customer_id, c.customer_id as cust_code, c.name as customer_name, c.relation, c.phone1, c.city, c.address,
             COALESCE(kt.balance, 0) as balance
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, balance
        FROM khata_transactions
        WHERE id IN (SELECT MAX(id) FROM khata_transactions GROUP BY customer_id)
      ) kt ON kt.customer_id = c.id
      WHERE c.is_deleted = 0 AND c.is_archived = 0 AND (c.notes IS NULL OR c.notes NOT LIKE 'Created via Girvi%')
      ORDER BY c.name ASC
    `).all();
  }
}

module.exports = new KhataRepository();
