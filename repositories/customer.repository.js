const BaseRepository = require('./base_repository');
const { parsePagination, parseSort, buildMeta, buildOrderClause } = require('../utils/pagination');
const { validateSearch } = require('../validation');
const { VALID_CUSTOMER_SORT_COLUMNS } = require('../validation/schemas');

class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers');
  }

  search(query = {}) {
    const { page, pageSize } = parsePagination(query);
    const { sortColumn, sortDirection } = parseSort(query, VALID_CUSTOMER_SORT_COLUMNS, 'created_at');
    const db = this.getDb();

    const conditions = ["is_deleted = 0", "(notes IS NULL OR notes NOT LIKE 'Created via Girvi%')"];
    const params = [];

    if (query.search) {
      const term = validateSearch(query.search);
      if (term) {
        const likeTerm = `%${term}%`;
        const cleanPhone = term.replace(/\D/g, '');

        if (cleanPhone.length >= 3) {
          const phoneTerm = `%${cleanPhone}%`;
          conditions.push("(name LIKE ? OR relation LIKE ? OR phone1 LIKE ? OR phone2 LIKE ? OR customer_id LIKE ? OR city LIKE ? OR address LIKE ? OR aadhaar_number LIKE ? OR notes LIKE ? OR phone1 LIKE ? OR phone2 LIKE ?)");
          params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, phoneTerm, phoneTerm);
        } else {
          conditions.push("(name LIKE ? OR relation LIKE ? OR phone1 LIKE ? OR phone2 LIKE ? OR customer_id LIKE ? OR city LIKE ? OR address LIKE ? OR aadhaar_number LIKE ? OR notes LIKE ?)");
          params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        }
      }
    }

    if (query.phone) {
      const cleanPhone = query.phone.replace(/\D/g, '');
      if (cleanPhone) {
        conditions.push("(phone1 LIKE ? OR phone2 LIKE ? OR phone1 LIKE ? OR phone2 LIKE ?)");
        params.push(`%${query.phone}%`, `%${query.phone}%`, `%${cleanPhone}%`, `%${cleanPhone}%`);
      } else {
        conditions.push("(phone1 LIKE ? OR phone2 LIKE ?)");
        params.push(`%${query.phone}%`, `%${query.phone}%`);
      }
    }

    if (query.city) {
      conditions.push("city = ?");
      params.push(query.city);
    }

    if (query.membership_level_id) {
      conditions.push("membership_level_id = ?");
      params.push(parseInt(query.membership_level_id, 10));
    }

    if (query.is_archived !== undefined) {
      conditions.push("is_archived = ?");
      params.push(query.is_archived ? 1 : 0);
    }

    if (query.data_source) {
      conditions.push("data_source = ?");
      params.push(query.data_source);
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = buildOrderClause(sortColumn, sortDirection);

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`;
    const total = db.prepare(countSql).get(...params).count;

    const dataSql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} ${orderClause} LIMIT ? OFFSET ?`;
    const data = db.prepare(dataSql).all(...params, pageSize, (page - 1) * pageSize);

    const pagination = buildMeta(total, page, pageSize);
    return { data, pagination };
  }

  getCounts() {
    const db = this.getDb();
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) as archived
      FROM customers WHERE is_deleted = 0
    `).get();
    return {
      total: row ? row.total || 0 : 0,
      active: row ? row.active || 0 : 0,
      archived: row ? row.archived || 0 : 0
    };
  }

  findByCustomerId(customerId) {
    return this.findOne({ where: { customer_id: customerId } });
  }

  findByName(name) {
    return this.findAll({ whereRaw: "name LIKE ? AND is_deleted = 0", params: [`%${name}%`], orderBy: 'name ASC' });
  }

  findByPhone(phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const db = this.getDb();
    return db.prepare("SELECT * FROM customers WHERE (phone1 = ? OR phone2 = ? OR replace(phone1, ' ', '') = ?) AND is_deleted = 0 LIMIT 1").get(phone, phone, cleanPhone);
  }

  getMaxCustomerNumber() {
    const db = this.getDb();
    const row = db.prepare("SELECT MAX(CAST(SUBSTR(customer_id, 6) AS INTEGER)) as max_num FROM customers WHERE customer_id LIKE 'CUST-%'").get();
    return row && row.max_num ? row.max_num : 0;
  }

  getCustomerSummary(customerId) {
    const db = this.getDb();
    const customer = this.findById(customerId);
    if (!customer) return null;

    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_bills,
        COALESCE(SUM(grand_total), 0) as total_purchases,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance_amount), 0) as total_pending,
        MAX(bill_date) as last_purchase_date
      FROM bills WHERE customer_id = ? AND status = 'active'
    `).get(customerId);

    // 3-Bucket Khata calculations: Opening Dues, Received Dues, Advance Deposit Held
    const khataStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'opening_balance' THEN (debit - credit) ELSE 0 END), 0) as opening_dues,
        COALESCE(SUM(CASE WHEN transaction_type = 'bill' THEN debit ELSE 0 END), 0) as bill_dues,
        COALESCE(SUM(CASE WHEN transaction_type IN ('payment', 'adjustment_credit') THEN credit ELSE 0 END), 0) as received_dues,
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN credit WHEN transaction_type = 'refund' THEN -debit ELSE 0 END), 0) as advance_deposit,
        COALESCE(SUM(CASE WHEN transaction_type = 'adjustment_debit' THEN debit ELSE 0 END), 0) as adjustment_debit
      FROM khata_transactions
      WHERE customer_id = ?
    `).get(customerId);

    const khataBalance = db.prepare(`
      SELECT COALESCE(balance, 0) as balance FROM khata_transactions
      WHERE customer_id = ? ORDER BY id DESC LIMIT 1
    `).get(customerId);

    const openingDues = khataStats ? khataStats.opening_dues : 0;
    const billDues = khataStats ? khataStats.bill_dues : 0;
    const receivedDues = khataStats ? khataStats.received_dues : 0;
    const advanceDeposit = khataStats ? khataStats.advance_deposit : 0;
    const adjDebit = khataStats ? khataStats.adjustment_debit : 0;

    // Dues strictly from purchases + opening balance - received payments
    const rawPendingDues = (openingDues + billDues + adjDebit) - receivedDues;
    const pendingDues = Math.max(0, rawPendingDues);

    return {
      ...customer,
      total_bills: totals.total_bills,
      total_purchases: totals.total_purchases,
      total_paid: totals.total_paid,
      total_pending: totals.total_pending,
      khata_balance: khataBalance ? khataBalance.balance : 0,
      opening_dues: openingDues,
      bill_dues: billDues,
      received_dues: receivedDues,
      pending_dues: pendingDues,
      advance_deposit: advanceDeposit,
      last_purchase_date: totals.last_purchase_date
    };
  }
}

module.exports = new CustomerRepository();
