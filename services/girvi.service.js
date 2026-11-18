const girviRepository = require('../repositories/girvi.repository');
const customerRepository = require('../repositories/customer.repository');
const BaseRepository = require('../repositories/base_repository');

function logActivity(userId, action, description) {
  try {
    const db = girviRepository.getDb();
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, module, description)
      VALUES (?, ?, 'girvi', ?)
    `).run(userId || null, action, description);
  } catch (e) {
    // Non-fatal if activity_logs is not present
  }
}

class GirviService {
  calculateDues(loan, asOfDateStr = null) {
    if (!loan) return null;

    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
    // Base date for interest calculation is last_interest_date if set, else loan_date
    const baseDateStr = loan.last_interest_date || loan.loan_date;
    const baseDate = new Date(baseDateStr);

    let totalDays = Math.floor((asOfDate - baseDate) / (1000 * 60 * 60 * 24));
    if (totalDays < 0) totalDays = 0;

    const txns = girviRepository.getTransactions(loan.id);
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;

    for (const t of txns) {
      if (t.transaction_type !== 'loan_disbursement') {
        totalInterestPaid += (t.interest_component || 0);
        totalPrincipalPaid += (t.principal_component || 0);
      }
    }

    const currentPrincipal = Math.max(0, loan.principal_amount - totalPrincipalPaid);
    const monthlyRate = parseFloat(loan.monthly_interest_percent) || 2.0;

    const monthsElapsed = Math.floor(totalDays / 30);
    const daysRemainder = totalDays % 30;
    const durationFormatted = `${monthsElapsed}m ${daysRemainder}d`;

    // Rule: If remainder >= 15 days, count as 1 full month.
    // Minimum 1 month ONLY if totalDays >= 1. If totalDays === 0 (paid today), billableMonths = 0.
    let billableMonths = 0;
    if (totalDays >= 1) {
      billableMonths = monthsElapsed + (daysRemainder >= 15 ? 1 : 0);
      if (billableMonths < 1) billableMonths = 1;
    }

    // ── SIMPLE INTEREST (always calculated for display) ───────────────────────
    // SI = (Principal x Rate x Months) / 100
    const simpleInterest = Math.round((currentPrincipal * monthlyRate * billableMonths) / 100 * 100) / 100;

    // ── COMPOUND INTEREST (always calculated for display — yearly compounding) ─
    // After each full year, annual interest is added to principal for next year
    const yearsElapsed = Math.floor(billableMonths / 12);
    const remMonths = billableMonths % 12;
    let compoundInterest = simpleInterest; // default: same as SI under 12 months
    let runningPrincipal = currentPrincipal;

    if (yearsElapsed >= 1) {
      const annualRate = (monthlyRate * 12) / 100;
      for (let y = 1; y <= yearsElapsed; y++) {
        runningPrincipal += runningPrincipal * annualRate;
      }
      const remInterest = (runningPrincipal * monthlyRate * remMonths) / 100;
      compoundInterest = Math.round(((runningPrincipal - currentPrincipal) + remInterest) * 100) / 100;
    }

    const compoundExtra = Math.round(Math.max(0, compoundInterest - simpleInterest) * 100) / 100;

    // ── WHICH IS CHARGED: determined by this loan's interest_type field ───────
    const interestType = (loan.interest_type === 'compound' || yearsElapsed >= 1) ? 'compound' : 'simple';
    const chargedInterest = interestType === 'compound' ? compoundInterest : simpleInterest;

    // Interest has been reset to baseDateStr (last_interest_date).
    // The unpaid interest running from that date onwards is chargedInterest.
    const remainingInterest = chargedInterest;
    const totalSimple = Math.round((currentPrincipal + simpleInterest) * 100) / 100;
    const totalCompound = Math.round((currentPrincipal + compoundInterest) * 100) / 100;
    const totalDues = Math.round((currentPrincipal + remainingInterest) * 100) / 100;

    return {
      loanId: loan.id,
      loanNumber: loan.loan_number,
      loanDate: loan.loan_date,
      lastInterestDate: baseDateStr,
      originalPrincipal: loan.principal_amount,
      currentPrincipal,
      monthlyRate,
      interestType,
      interestTypeLabel: interestType === 'compound' ? 'चक्रवर्ती ब्याज (Compound)' : 'साधारण ब्याज (Simple)',
      totalDays,
      monthsElapsed,
      daysRemainder,
      billableMonths,
      yearsElapsed,
      durationFormatted,
      // Both values always returned — UI shows them side-by-side
      simpleInterest,
      compoundInterest,
      compoundExtra,
      // Which is actually charged (per loan's interest_type)
      chargedInterest: Math.round(chargedInterest * 100) / 100,
      // Backward-compat aliases (older screen code uses these)
      accumulatedInterest: Math.round(chargedInterest * 100) / 100,
      compoundInterestValue: yearsElapsed >= 1 ? compoundInterest : 0,
      totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
      remainingInterest: Math.round(remainingInterest * 100) / 100,
      totalPrincipalPaid: Math.round(totalPrincipalPaid * 100) / 100,
      totalSimple,
      totalCompound,
      totalDues: Math.round(totalDues * 100) / 100,
      transactions: txns
    };
  }

  getLoanById(id) {
    const loan = girviRepository.findById(id);
    if (!loan || loan.is_deleted) return null;
    const dues = this.calculateDues(loan);
    return { ...loan, dues };
  }

  searchLoans(query = {}) {
    const res = girviRepository.search(query);
    res.data = res.data.map(loan => ({
      ...loan,
      dues: this.calculateDues(loan)
    }));
    return res;
  }

  search(query = {}) {
    return this.searchLoans(query);
  }

  getSummary() {
    return girviRepository.getSummary();
  }

  createLoan(data, userId = null) {
    let cleanPhone = String(data.phone1 || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      if (data.data_source === 'imported' || !cleanPhone) {
        cleanPhone = '9999999999';
      } else {
        throw new Error('Valid 10-digit phone number is required');
      }
    }

    const custName = (data.customer_name && data.customer_name.trim().length > 0)
      ? data.customer_name.trim()
      : 'Customer Record';
    const custAddress = (data.address && data.address.trim().length > 0)
      ? data.address.trim()
      : 'Local';
    const itemName = (data.item_name && data.item_name.trim().length > 0)
      ? data.item_name.trim()
      : 'Jewellery Ornament';

    // Link customer record ONLY IF a retail customer already exists with this phone.
    // Girvi operates as its own dedicated section and does NOT create dummy records in the retail customer/khata ledger.
    let customer = null;
    if (cleanPhone && cleanPhone !== '9999999999') {
      try {
        const found = customerRepository.findByPhone(cleanPhone);
        if (found && (!found.notes || !found.notes.includes('Created via Girvi'))) {
          customer = found;
        }
      } catch (_) {}
    }

    let loanNumber = (data.loan_number && data.loan_number.trim().length > 0)
      ? data.loan_number.trim()
      : girviRepository.generateNextLoanNumber();

    // Check if this loan was permanently deleted by owner
    const db = require('../database/connection').getDb();
    try {
      const tombstone = db.prepare("SELECT id FROM sync_tombstones WHERE entity_name = 'girvi_loans' AND entity_key = ?").get(loanNumber);
      if (tombstone) {
        throw new Error(`Loan '${loanNumber}' was permanently deleted by owner and will not be re-imported`);
      }
    } catch (e) {
      if (e.message.includes('permanently deleted')) throw e;
    }

    let existing = girviRepository.findByLoanNumber(loanNumber);
    if (existing) {
      if (data.data_source === 'imported') {
        // Prevent duplicate creation on re-importing the same CSV/backup
        const isSameLoan = (existing.customer_name === data.customer_name.trim() || existing.phone1 === cleanPhone) &&
                           Math.abs(existing.principal_amount - parseFloat(data.principal_amount)) < 1;
        if (isSameLoan || existing.loan_number === loanNumber) {
          // Update the existing loan with any new fields (e.g. locker_number, interest_type) rather than creating a duplicate
          return this.updateLoan(existing.id, {
            customer_name: data.customer_name,
            father_husband_name: data.father_husband_name || existing.father_husband_name,
            caste: data.caste || existing.caste,
            phone1: cleanPhone,
            address: custAddress,
            item_name: itemName,
            gold_weight: data.gold_weight,
            silver_weight: data.silver_weight,
            principal_amount: data.principal_amount,
            monthly_interest_percent: data.monthly_interest_percent,
            interest_type: data.interest_type || existing.interest_type || 'simple',
            locker_number: data.locker_number || existing.locker_number,
            reference_person: data.reference_person || existing.reference_person,
            notes: data.notes || existing.notes
          }, userId);
        }

        let counter = 1;
        while (girviRepository.findByLoanNumber(`${loanNumber}-${counter}`)) {
          counter++;
        }
        loanNumber = `${loanNumber}-${counter}`;
      } else {
        throw new Error(`Girvi Loan Number '${loanNumber}' already exists`);
      }
    }


    const uuidStr = require('crypto').randomUUID ? require('crypto').randomUUID() : `girvi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const loanData = {
      uuid: uuidStr,
      loan_number: loanNumber,
      customer_id: customer ? customer.id : null,
      customer_name: data.customer_name.trim(),
      father_husband_name: data.father_husband_name ? data.father_husband_name.trim() : null,
      caste: data.caste ? data.caste.trim() : null,
      phone1: cleanPhone,
      address: data.address.trim(),
      loan_date: data.loan_date || new Date().toISOString().split('T')[0],
      last_interest_date: data.last_interest_date || data.loan_date || new Date().toISOString().split('T')[0],
      item_name: data.item_name.trim(),
      metal_type: data.metal_type || 'gold',
      gold_weight: parseFloat(data.gold_weight) || 0.000,
      silver_weight: parseFloat(data.silver_weight) || 0.000,
      principal_amount: parseFloat(data.principal_amount),
      monthly_interest_percent: parseFloat(data.monthly_interest_percent) || 2.0,
      interest_type: data.interest_type === 'compound' ? 'compound' : 'simple',
      locker_number: data.locker_number ? data.locker_number.trim() : null,
      reference_person: data.reference_person ? data.reference_person.trim() : null,
      notes: data.notes ? data.notes.trim() : null,
      photo_path: data.photo_path || null,
      status: 'active',
      data_source: data.data_source || 'live'
    };

    const newLoan = girviRepository.create(loanData);

    // Initial disbursement transaction
    girviRepository.createTransaction({
      girvi_loan_id: newLoan.id,
      transaction_date: newLoan.loan_date,
      transaction_type: 'loan_disbursement',
      amount: newLoan.principal_amount,
      interest_component: 0,
      principal_component: 0,
      remaining_principal: newLoan.principal_amount,
      payment_method: 'cash',
      notes: 'Initial Girvi Loan Disbursement',
      user_id: userId
    });

    logActivity(userId, 'create', `Created Girvi loan #${newLoan.loan_number} for customer ${newLoan.customer_name} (₹${newLoan.principal_amount})`);

    return this.getLoanById(newLoan.id);
  }

  updateLoan(id, data, userId = null) {
    const existing = girviRepository.findById(id);
    if (!existing || existing.is_deleted) {
      throw new Error('Girvi loan record not found');
    }

    const cleanPhone = data.phone1 ? String(data.phone1).replace(/\D/g, '') : existing.phone1;

    const updatedData = {
      customer_name: data.customer_name ? data.customer_name.trim() : existing.customer_name,
      father_husband_name: data.father_husband_name !== undefined ? (data.father_husband_name ? data.father_husband_name.trim() : null) : existing.father_husband_name,
      caste: data.caste !== undefined ? (data.caste ? data.caste.trim() : null) : existing.caste,
      phone1: cleanPhone,
      address: data.address ? data.address.trim() : existing.address,
      loan_date: data.loan_date || existing.loan_date,
      item_name: data.item_name ? data.item_name.trim() : existing.item_name,
      metal_type: data.metal_type || existing.metal_type,
      gold_weight: data.gold_weight !== undefined ? (parseFloat(data.gold_weight) || 0.000) : existing.gold_weight,
      silver_weight: data.silver_weight !== undefined ? (parseFloat(data.silver_weight) || 0.000) : existing.silver_weight,
      principal_amount: data.principal_amount !== undefined ? parseFloat(data.principal_amount) : existing.principal_amount,
      monthly_interest_percent: data.monthly_interest_percent !== undefined ? parseFloat(data.monthly_interest_percent) : existing.monthly_interest_percent,
      interest_type: data.interest_type !== undefined ? (data.interest_type === 'compound' ? 'compound' : 'simple') : (existing.interest_type || 'simple'),
      locker_number: data.locker_number !== undefined ? (data.locker_number ? data.locker_number.trim() : null) : existing.locker_number,
      reference_person: data.reference_person !== undefined ? (data.reference_person ? data.reference_person.trim() : null) : existing.reference_person,
      notes: data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : existing.notes,
      photo_path: data.photo_path !== undefined ? data.photo_path : existing.photo_path,
      updated_at: new Date().toISOString()
    };

    girviRepository.update(id, updatedData);

    logActivity(userId, 'update', `Updated Girvi loan #${existing.loan_number} (${updatedData.customer_name})`);

    return this.getLoanById(id);
  }

  softDeleteLoan(id, userId = null) {
    const existing = girviRepository.findById(id);
    if (!existing || existing.is_deleted) {
      throw new Error('Girvi loan record not found');
    }

    girviRepository.softDelete(id);

    // Set deleted_at timestamp for audit and sync purposes
    try {
      const db = require('../database/connection').getDb();
      db.prepare("UPDATE girvi_loans SET deleted_at = datetime('now','localtime'), is_deleted = 1 WHERE id = ?").run(id);
    } catch (_) {}

    logActivity(userId, 'delete', `Soft-deleted Girvi loan #${existing.loan_number} (${existing.customer_name})`);

    return true;
  }

  permanentDeleteLoan(id, userId = null) {
    const existing = girviRepository.findById(id);
    if (!existing) {
      throw new Error('Girvi loan record not found');
    }

    const db = require('../database/connection').getDb();

    // 1. Delete associated transactions first
    try {
      db.prepare("DELETE FROM girvi_transactions WHERE girvi_loan_id = ?").run(id);
    } catch (_) {}

    // 2. Record tombstone so sync and import never resurrect this permanently deleted loan
    try {
      db.prepare(`
        INSERT INTO sync_tombstones (entity_name, entity_id, entity_key, deleted_at)
        VALUES ('girvi_loans', ?, ?, datetime('now', 'localtime'))
      `).run(id, existing.loan_number || '');
    } catch (_) {}

    // 3. Delete from girvi_loans table
    try {
      db.prepare("DELETE FROM girvi_loans WHERE id = ?").run(id);
    } catch (e) {
      throw new Error('Failed to permanently delete loan: ' + e.message);
    }

    logActivity(userId, 'permanent_delete', `Permanently deleted Girvi loan #${existing.loan_number} (${existing.customer_name})`);

    return true;
  }


  recordPayment(data, userId = null) {
    const loan = girviRepository.findById(data.girvi_loan_id);
    if (!loan || loan.is_deleted) {
      throw new Error('Girvi loan record not found');
    }

    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) {
      throw new Error('Valid payment amount is required');
    }

    const dues = this.calculateDues(loan);
    const paymentDate = data.transaction_date || new Date().toISOString().split('T')[0];
    let interestPaid = parseFloat(data.interest_component) || 0;
    let principalPaid = parseFloat(data.principal_component) || 0;

    // Explicit or auto-split payment handling
    if (data.transaction_type === 'interest_payment') {
      interestPaid = amount;
      principalPaid = 0;
    } else if (data.transaction_type === 'part_payment') {
      principalPaid = amount;
      interestPaid = 0;
    } else if (!data.interest_component && !data.principal_component) {
      // Auto-split: pay interest first, remainder to principal
      if (amount <= dues.remainingInterest) {
        interestPaid = amount;
        principalPaid = 0;
      } else {
        interestPaid = dues.remainingInterest;
        principalPaid = amount - dues.remainingInterest;
      }
    }

    const newRemainingPrincipal = Math.max(0, dues.currentPrincipal - principalPaid);
    const txnType = data.transaction_type || (newRemainingPrincipal === 0 && dues.remainingInterest <= interestPaid ? 'full_redemption' : (interestPaid > 0 ? 'interest_payment' : 'part_payment'));

    const txn = girviRepository.createTransaction({
      girvi_loan_id: loan.id,
      transaction_date: paymentDate,
      transaction_type: txnType,
      amount,
      interest_component: interestPaid,
      principal_component: principalPaid,
      remaining_principal: newRemainingPrincipal,
      payment_method: data.payment_method || 'cash',
      notes: data.notes || null,
      user_id: userId
    });

    const updateFields = {
      updated_at: new Date().toISOString()
    };

    // Girvi Indian Jeweller Rule: When customer pays interest,
    // update base date to payment date; interest starts fresh from that day;
    // principal remains strictly untouched if principalPaid === 0!
    if (interestPaid > 0) {
      updateFields.last_interest_date = paymentDate;
    }

    if (newRemainingPrincipal === 0 && dues.remainingInterest <= interestPaid) {
      updateFields.status = 'redeemed';
    } else if (principalPaid > 0) {
      updateFields.status = 'partially_redeemed';
    }

    girviRepository.update(loan.id, updateFields);

    logActivity(userId, 'payment', `Recorded payment ₹${amount} for Girvi #${loan.loan_number} (Interest: ₹${interestPaid}, Principal: ₹${principalPaid}, New Interest Base Date: ${updateFields.last_interest_date || loan.last_interest_date || loan.loan_date})`);

    return this.getLoanById(loan.id);
  }

  deletePayment(transactionId, loanId = null, userId = null) {
    const txn = girviRepository.getTransactionById(transactionId);
    if (!txn) {
      throw new Error('Transaction record not found');
    }

    if (txn.transaction_type === 'loan_disbursement') {
      throw new Error('Cannot delete initial loan disbursement transaction');
    }

    const targetLoanId = loanId || txn.girvi_loan_id;
    const loan = girviRepository.findById(targetLoanId);
    if (!loan || loan.is_deleted) {
      throw new Error('Girvi loan record not found');
    }

    // 1. Delete the transaction record
    girviRepository.deleteTransaction(transactionId);

    // 2. Fetch remaining transactions for this loan
    const remainingTxns = girviRepository.getTransactions(loan.id);

    // 3. Recalculate last_interest_date:
    // Find latest interest payment date among remaining transactions.
    // If none remain, fallback to original loan_date.
    const interestTxns = remainingTxns.filter(t =>
      t.transaction_type !== 'loan_disbursement' &&
      ((t.interest_component || 0) > 0 || t.transaction_type === 'interest_payment')
    );

    let newLastInterestDate = loan.loan_date;
    if (interestTxns.length > 0) {
      newLastInterestDate = interestTxns.reduce((latest, t) => {
        return (t.transaction_date > latest) ? t.transaction_date : latest;
      }, interestTxns[0].transaction_date);
    }

    // 4. Recalculate remaining principal & status
    let totalPrincipalPaid = 0;
    for (const t of remainingTxns) {
      if (t.transaction_type !== 'loan_disbursement') {
        totalPrincipalPaid += (t.principal_component || 0);
      }
    }

    const remainingPrincipal = Math.max(0, loan.principal_amount - totalPrincipalPaid);
    let newStatus = 'active';
    if (remainingPrincipal <= 0) {
      newStatus = 'redeemed';
    } else if (totalPrincipalPaid > 0) {
      newStatus = 'partially_redeemed';
    }

    // 5. Update loan record with restored dates and status
    girviRepository.update(loan.id, {
      last_interest_date: newLastInterestDate,
      status: newStatus,
      updated_at: new Date().toISOString()
    });

    logActivity(
      userId,
      'delete_payment',
      `Undid/Deleted payment transaction #${transactionId} (₹${txn.amount}) for Girvi #${loan.loan_number}. Restored interest base date: ${newLastInterestDate}`
    );

    return this.getLoanById(loan.id);
  }

  _ensureBatchesTable(db) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS girvi_import_batches (
          id TEXT PRIMARY KEY,
          import_type TEXT NOT NULL DEFAULT 'csv',
          record_count INTEGER NOT NULL DEFAULT 0,
          loan_ids_json TEXT NOT NULL,
          is_undone INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          undone_at TEXT
        );
      `);
    } catch (e) {}
  }

  // --- Import Batch History & Persistent Undo / Redo Management ---
  recordImportBatch(batch) {
    if (!this._undoStack) this._undoStack = [];
    if (!this._redoStack) this._redoStack = [];
    this._undoStack.push(batch);
    this._redoStack = [];

    try {
      const db = girviRepository.getDb();
      this._ensureBatchesTable(db);
      db.prepare(`
        INSERT OR REPLACE INTO girvi_import_batches (id, import_type, record_count, loan_ids_json, is_undone, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now', 'localtime'))
      `).run(batch.batchId, 'csv', batch.successCount, JSON.stringify(batch.loanIds || []));
    } catch (e) {
      console.warn('Could not persist import batch to db:', e.message);
    }
  }

  getImportStatus() {
    try {
      const db = girviRepository.getDb();
      this._ensureBatchesTable(db);
      const lastActive = db.prepare("SELECT * FROM girvi_import_batches WHERE is_undone = 0 ORDER BY rowid DESC LIMIT 1").get();
      const lastUndone = db.prepare("SELECT * FROM girvi_import_batches WHERE is_undone = 1 ORDER BY rowid DESC LIMIT 1").get();

      return {
        canUndo: !!lastActive,
        canRedo: !!lastUndone,
        lastUndoBatch: lastActive ? {
          batchId: lastActive.id,
          successCount: lastActive.record_count,
          createdAt: lastActive.created_at,
          loanIds: JSON.parse(lastActive.loan_ids_json || '[]')
        } : null,
        lastRedoBatch: lastUndone ? {
          batchId: lastUndone.id,
          successCount: lastUndone.record_count,
          undoneAt: lastUndone.undone_at,
          loanIds: JSON.parse(lastUndone.loan_ids_json || '[]')
        } : null
      };
    } catch (e) {
      if (!this._undoStack) this._undoStack = [];
      if (!this._redoStack) this._redoStack = [];
      return {
        canUndo: this._undoStack.length > 0,
        canRedo: this._redoStack.length > 0,
        lastUndoBatch: this._undoStack[this._undoStack.length - 1] || null,
        lastRedoBatch: this._redoStack[this._redoStack.length - 1] || null
      };
    }
  }

  undoLastImport(userId = null) {
    const status = this.getImportStatus();
    if (!status.canUndo || !status.lastUndoBatch) {
      throw new Error('No import batch available to undo');
    }
    const batch = status.lastUndoBatch;
    let count = 0;
    for (const loanId of (batch.loanIds || [])) {
      try {
        girviRepository.softDelete(loanId);
        count++;
      } catch (e) {}
    }

    try {
      const db = girviRepository.getDb();
      db.prepare("UPDATE girvi_import_batches SET is_undone = 1, undone_at = datetime('now', 'localtime') WHERE id = ?").run(batch.batchId);
    } catch (e) {}

    logActivity(userId, 'delete', `Reverted Girvi import batch #${batch.batchId} (${count} records)`);
    return { success: true, count, batchId: batch.batchId };
  }

  redoLastImport(userId = null) {
    const status = this.getImportStatus();
    if (!status.canRedo || !status.lastRedoBatch) {
      throw new Error('No undone import batch available to redo');
    }
    const batch = status.lastRedoBatch;
    let count = 0;
    for (const loanId of (batch.loanIds || [])) {
      try {
        girviRepository.update(loanId, { is_deleted: 0 });
        count++;
      } catch (e) {}
    }

    try {
      const db = girviRepository.getDb();
      db.prepare("UPDATE girvi_import_batches SET is_undone = 0, undone_at = NULL WHERE id = ?").run(batch.batchId);
    } catch (e) {}

    logActivity(userId, 'create', `Restored Girvi import batch #${batch.batchId} (${count} records)`);
    return { success: true, count, batchId: batch.batchId };
  }
}

module.exports = new GirviService();
