const BaseRepository = require('./base_repository');
const { parsePagination, parseSort, buildMeta, buildOrderClause } = require('../utils/pagination');
const { validateSearch } = require('../validation');
const { v4: uuidv4 } = require('crypto');

class GirviRepository extends BaseRepository {
  constructor() {
    super('girvi_loans');
  }

  generateNextLoanNumber() {
    const db = this.getDb();
    const row = db.prepare(`
      SELECT loan_number FROM girvi_loans 
      WHERE loan_number LIKE 'GIR-%' 
      ORDER BY id DESC LIMIT 1
    `).get();

    if (!row || !row.loan_number) {
      return 'GIR-0001';
    }

    const match = row.loan_number.match(/GIR-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      return `GIR-${String(num).padStart(4, '0')}`;
    }
    return `GIR-${Date.now().toString().slice(-6)}`;
  }

  search(query = {}) {
    const { page, pageSize, offset } = parsePagination(query);
    const db = this.getDb();

    const conditions = ["is_deleted = 0"];
    const params = [];

    if (query.status && query.status !== 'all') {
      conditions.push("status = ?");
      params.push(query.status);
    }

    if (query.metal_type && query.metal_type !== 'all') {
      conditions.push("metal_type = ?");
      params.push(query.metal_type);
    }

    if (query.search) {
      const term = validateSearch(query.search);
      if (term) {
        const likeTerm = `%${term}%`;
        const cleanPhone = term.replace(/\D/g, '');
        if (cleanPhone.length >= 3) {
          const phoneTerm = `%${cleanPhone}%`;
          conditions.push("(loan_number LIKE ? OR customer_name LIKE ? OR father_husband_name LIKE ? OR caste LIKE ? OR phone1 LIKE ? OR address LIKE ? OR item_name LIKE ? OR CAST(principal_amount AS TEXT) LIKE ? OR locker_number LIKE ? OR reference_person LIKE ? OR notes LIKE ? OR phone1 LIKE ?)");
          params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, phoneTerm);
        } else {
          conditions.push("(loan_number LIKE ? OR customer_name LIKE ? OR father_husband_name LIKE ? OR caste LIKE ? OR phone1 LIKE ? OR address LIKE ? OR item_name LIKE ? OR CAST(principal_amount AS TEXT) LIKE ? OR locker_number LIKE ? OR reference_person LIKE ? OR notes LIKE ?)");
          params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM girvi_loans ${whereClause}`).get(...params);
    const total = countRow ? countRow.count : 0;

    const data = db.prepare(`
      SELECT * FROM girvi_loans 
      ${whereClause} 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return {
      data,
      pagination: buildMeta(total, page, pageSize)
    };
  }

  findByLoanNumber(loanNumber) {
    const db = this.getDb();
    return db.prepare("SELECT * FROM girvi_loans WHERE loan_number = ? AND is_deleted = 0").get(loanNumber);
  }

  getSummary() {
    const db = this.getDb();
    const activeStats = db.prepare(`
      SELECT 
        COUNT(*) as active_count,
        COALESCE(SUM(principal_amount), 0) as total_principal,
        COALESCE(SUM(gold_weight), 0) as total_gold_weight,
        COALESCE(SUM(silver_weight), 0) as total_silver_weight
      FROM girvi_loans
      WHERE status = 'active' AND is_deleted = 0
    `).get();

    const txnStats = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_paid,
        COALESCE(SUM(interest_component), 0) as total_interest_collected,
        COALESCE(SUM(principal_component), 0) as total_principal_repaid
      FROM girvi_transactions
    `).get();

    return {
      activeCount: activeStats.active_count || 0,
      totalPrincipalDisbursed: activeStats.total_principal || 0,
      totalGoldWeight: activeStats.total_gold_weight || 0,
      totalSilverWeight: activeStats.total_silver_weight || 0,
      totalPaid: txnStats.total_paid || 0,
      totalInterestCollected: txnStats.total_interest_collected || 0,
      totalPrincipalRepaid: txnStats.total_principal_repaid || 0
    };
  }

  getTransactions(girviLoanId) {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM girvi_transactions 
      WHERE girvi_loan_id = ? 
      ORDER BY id ASC
    `).all(girviLoanId);
  }

  createTransaction(txn) {
    const db = this.getDb();
    const uuidStr = require('crypto').randomUUID ? require('crypto').randomUUID() : `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const info = db.prepare(`
      INSERT INTO girvi_transactions (
        uuid, girvi_loan_id, transaction_date, transaction_type,
        amount, interest_component, principal_component, remaining_principal,
        payment_method, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidStr,
      txn.girvi_loan_id,
      txn.transaction_date || new Date().toISOString().split('T')[0],
      txn.transaction_type,
      txn.amount || 0,
      txn.interest_component || 0,
      txn.principal_component || 0,
      txn.remaining_principal || 0,
      txn.payment_method || 'cash',
      txn.notes || null,
      txn.user_id || null
    );

    return this.findByIdTable('girvi_transactions', info.lastInsertRowid);
  }

  create(data) {
    const res = super.create(data);
    return this.findById(res.id);
  }

  findByIdTable(tableName, id) {
    const db = this.getDb();
    return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
  }

  getTransactionById(id) {
    const db = this.getDb();
    return db.prepare("SELECT * FROM girvi_transactions WHERE id = ?").get(id);
  }

  deleteTransaction(id) {
    const db = this.getDb();
    return db.prepare("DELETE FROM girvi_transactions WHERE id = ?").run(id);
  }

  softDelete(id) {
    const db = this.getDb();
    db.prepare(`
      UPDATE girvi_loans 
      SET is_deleted = 1, updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(id);
    return true;
  }
}

module.exports = new GirviRepository();
