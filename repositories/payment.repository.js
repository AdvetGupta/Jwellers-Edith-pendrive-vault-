const BaseRepository = require('./base_repository');
const { parsePagination, parseSort, buildMeta, buildOrderClause } = require('../utils/pagination');
const { VALID_PAYMENT_SORT_COLUMNS } = require('../validation/schemas');

class PaymentRepository extends BaseRepository {
  constructor() {
    super('payments');
  }

  search(query = {}) {
    const { page, pageSize } = parsePagination(query);
    const { sortColumn, sortDirection } = parseSort(query, VALID_PAYMENT_SORT_COLUMNS, 'created_at');
    const db = this.getDb();

    const conditions = [];
    const params = [];

    if (query.customer_id) {
      conditions.push("p.customer_id = ?");
      params.push(parseInt(query.customer_id, 10));
    }

    if (query.payment_method) {
      conditions.push("p.payment_method = ?");
      params.push(query.payment_method);
    }

    if (query.type) {
      conditions.push("p.type = ?");
      params.push(query.type);
    }

    if (query.date_from) {
      conditions.push("p.payment_date >= ?");
      params.push(query.date_from);
    }

    if (query.date_to) {
      conditions.push("p.payment_date <= ?");
      params.push(query.date_to);
    }

    if (query.user_id) {
      conditions.push("p.user_id = ?");
      params.push(parseInt(query.user_id, 10));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderClause = buildOrderClause(sortColumn, sortDirection, 'p');

    const countSql = `SELECT COUNT(*) as count FROM payments p ${whereClause}`;
    const total = db.prepare(countSql).get(...params).count;

    const dataSql = `
      SELECT p.*, c.name as customer_name, c.phone1 as customer_phone,
             u.display_name as user_name
      FROM payments p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN users u ON u.id = p.user_id
      ${whereClause}
      ${orderClause} LIMIT ? OFFSET ?`;
    const data = db.prepare(dataSql).all(...params, pageSize, (page - 1) * pageSize);

    return { data, pagination: buildMeta(total, page, pageSize) };
  }

  getCustomerPayments(customerId) {
    return this.findAll({
      where: { customer_id: customerId },
      orderBy: 'payment_date DESC, created_at DESC'
    });
  }

  getTotalPaidForBill(billId) {
    const db = this.getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(pa.amount), 0) as total
      FROM payment_allocations pa
      WHERE pa.bill_id = ?
    `).get(billId);
    return row ? row.total : 0;
  }
}

module.exports = new PaymentRepository();
