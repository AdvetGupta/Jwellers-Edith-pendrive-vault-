const BaseRepository = require('./base_repository');
const { parsePagination, parseSort, buildMeta, buildOrderClause } = require('../utils/pagination');
const { validateSearch } = require('../validation');
const { VALID_BILL_SORT_COLUMNS } = require('../validation/schemas');

class BillRepository extends BaseRepository {
  constructor() {
    super('bills');
  }

  search(query = {}) {
    const { page, pageSize } = parsePagination(query);
    const { sortColumn, sortDirection } = parseSort(query, VALID_BILL_SORT_COLUMNS, 'created_at');
    const db = this.getDb();

    const conditions = [];
    const params = [];

    if (query.search) {
      const term = validateSearch(query.search);
      if (term) {
        conditions.push("(b.invoice_number LIKE ? OR c.name LIKE ? OR c.phone1 LIKE ?)");
        params.push(`%${term}%`, `%${term}%`, `%${term}%`);
      }
    }

    if (query.customer_id) {
      conditions.push("b.customer_id = ?");
      params.push(parseInt(query.customer_id, 10));
    }

    if (query.bill_type) {
      conditions.push("b.bill_type = ?");
      params.push(query.bill_type);
    }

    if (query.payment_status) {
      conditions.push("b.payment_status = ?");
      params.push(query.payment_status);
    }

    if (query.status) {
      conditions.push("b.status = ?");
      params.push(query.status);
    }

    if (query.date_from) {
      conditions.push("b.bill_date >= ?");
      params.push(query.date_from);
    }

    if (query.date_to) {
      conditions.push("b.bill_date <= ?");
      params.push(query.date_to);
    }

    if (query.user_id) {
      conditions.push("b.user_id = ?");
      params.push(parseInt(query.user_id, 10));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as count FROM bills b LEFT JOIN customers c ON c.id = b.customer_id ${whereClause}`;
    const total = db.prepare(countSql).get(...params).count;

    const orderClause = buildOrderClause(sortColumn, sortDirection, 'b');

    const dataSql = `
      SELECT b.*, c.name as customer_name, c.phone1 as customer_phone
      FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      ${whereClause}
      ${orderClause} LIMIT ? OFFSET ?`;
    const data = db.prepare(dataSql).all(...params, pageSize, (page - 1) * pageSize);

    return { data, pagination: buildMeta(total, page, pageSize) };
  }

  findByInvoiceNumber(invoiceNumber) {
    return this.findOne({ where: { invoice_number: invoiceNumber } });
  }

  getMaxInvoiceNumber(prefix, year) {
    const db = this.getDb();
    const pattern = `${prefix}${year}-%`;
    const row = db.prepare(`
      SELECT MAX(CAST(SUBSTR(invoice_number, LENGTH(?) + 1) AS INTEGER)) as max_num
      FROM bills WHERE invoice_number LIKE ?
    `).get(pattern, pattern);
    return row && row.max_num ? row.max_num : 0;
  }

  getBillWithItems(billId) {
    const db = this.getDb();
    const bill = db.prepare(`
      SELECT b.*, c.name as customer_name, c.phone1 as customer_phone, c.address as customer_address,
             u.display_name as user_name
      FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = ?
    `).get(billId);

    if (!bill) return null;

    bill.items = db.prepare(`
      SELECT bi.*, p.product_name, c.name as category_name
      FROM bill_items bi
      LEFT JOIN products p ON p.id = bi.product_id
      LEFT JOIN categories c ON c.id = bi.category_id
      WHERE bi.bill_id = ?
      ORDER BY bi.sort_order ASC, bi.id ASC
    `).all(billId);

    return bill;
  }
}

module.exports = new BillRepository();
