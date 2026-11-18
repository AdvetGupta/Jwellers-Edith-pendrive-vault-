const { khataRepository, customerRepository } = require('../repositories');
const { AppError } = require('../errors/app-error');
const { validateString, validateDate } = require('../validation');
const audit = require('../logging/audit');
const TransactionManager = require('../database/transaction_manager');

class KhataService {
  getCustomerKhata(customerId) {
    const customer = customerRepository.findById(customerId);
    if (!customer || customer.is_deleted) {
      throw AppError.notFound('Customer');
    }
    return khataRepository.getCustomerKhata(customerId);
  }

  getCurrentBalance(customerId) {
    return khataRepository.getCurrentBalance(customerId);
  }

  getOutstandingCustomers() {
    return khataRepository.getOutstandingCustomers();
  }

  getAllCustomersWithBalance() {
    return khataRepository.getAllCustomersWithBalance();
  }

  search(query) {
    return khataRepository.search(query);
  }

  recordPayment(customerId, amount, userId, paymentId = null, notes = null) {
    const currentBalance = khataRepository.getCurrentBalance(customerId);
    const newBalance = currentBalance - amount;

    return khataRepository.create({
      customer_id: customerId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'payment',
      debit: 0,
      credit: amount,
      balance: Math.max(0, newBalance),
      payment_id: paymentId,
      notes: notes || 'Payment received',
      user_id: userId
    });
  }

  recordBill(customerId, billAmount, billId, userId) {
    const currentBalance = khataRepository.getCurrentBalance(customerId);
    const newBalance = currentBalance + billAmount;

    return khataRepository.create({
      customer_id: customerId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'bill',
      debit: billAmount,
      credit: 0,
      balance: newBalance,
      bill_id: billId,
      user_id: userId
    });
  }

  recordOpeningBalance(customerId, amount, userId, notes = null) {
    const customer = customerRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer');

    const currentBalance = khataRepository.getCurrentBalance(customerId);

    const result = khataRepository.create({
      customer_id: customerId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'opening_balance',
      debit: amount > 0 ? amount : 0,
      credit: amount < 0 ? Math.abs(amount) : 0,
      balance: currentBalance + amount,
      notes: notes || (currentBalance === 0 ? 'Opening balance' : 'Previous dues adjustment'),
      user_id: userId,
      data_source: currentBalance === 0 ? 'migrated' : 'manual'
    });
    return khataRepository.findById(result.id);
  }

  adjust(customerId, data, userId) {
    const customer = customerRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer');

    const currentBalance = khataRepository.getCurrentBalance(customerId);
    const rawAmount = parseFloat(data.amount);
    if (isNaN(rawAmount) || rawAmount === 0) {
      throw AppError.validation('Adjustment amount must be a non-zero number');
    }
    if (Math.abs(rawAmount) > 999999999) {
      throw AppError.validation('Adjustment amount exceeds maximum value');
    }
    const adjustmentAmount = Math.round(rawAmount * 100) / 100;
    const notes = validateString(data.notes || 'Manual adjustment', 'Notes', 500);

    const isDebit = adjustmentAmount >= 0;
    const newBalance = isDebit ? currentBalance + adjustmentAmount : currentBalance - Math.abs(adjustmentAmount);

    const transaction = khataRepository.create({
      customer_id: customerId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: isDebit ? 'adjustment_debit' : 'adjustment_credit',
      debit: isDebit ? adjustmentAmount : 0,
      credit: isDebit ? 0 : Math.abs(adjustmentAmount),
      balance: newBalance,
      notes: notes,
      user_id: userId
    });

    audit.log(userId, 'KHATA_ADJUSTED', 'khata_transactions', transaction.id,
      `Khata adjusted for ${customer.name}: ${isDebit ? 'debited' : 'credited'} ${Math.abs(adjustmentAmount)}`);

    return { id: transaction.id, balance: newBalance };
  }

  recordDeposit(customerId, amount, userId, notes = null) {
    const customer = customerRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer');

    const currentBalance = khataRepository.getCurrentBalance(customerId);
    const depositAmount = Math.round(parseFloat(amount) * 100) / 100;
    if (isNaN(depositAmount) || depositAmount <= 0) {
      throw AppError.validation('Deposit amount must be a positive number');
    }
    if (depositAmount > 999999999) {
      throw AppError.validation('Deposit amount exceeds maximum value');
    }

    const newBalance = currentBalance - depositAmount;

    const transaction = khataRepository.create({
      customer_id: customerId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'deposit',
      debit: 0,
      credit: depositAmount,
      balance: Math.round(newBalance * 100) / 100,
      notes: notes || 'Advance deposit for future purchase',
      user_id: userId
    });

    audit.log(userId, 'KHATA_DEPOSIT', 'khata_transactions', transaction.id,
      `Deposit of ₹${depositAmount} recorded for ${customer.name}`);

    return { id: transaction.id, balance: newBalance };
  }

  reduceDeposit(customerId, amount, userId, notes = null, reason = 'refund') {
    const customer = customerRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer');

    const reduceAmount = Math.round(parseFloat(amount) * 100) / 100;
    if (isNaN(reduceAmount) || reduceAmount <= 0) {
      throw AppError.validation('Reduction amount must be a positive number');
    }
    if (reduceAmount > 999999999) {
      throw AppError.validation('Reduction amount exceeds maximum value');
    }

    const db = khataRepository.getDb();
    const depositRow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN credit WHEN transaction_type = 'refund' THEN -debit ELSE 0 END), 0) as available_deposit
      FROM khata_transactions
      WHERE customer_id = ?
    `).get(customerId);

    const availableDeposit = depositRow ? depositRow.available_deposit : 0;
    if (availableDeposit > 0 && reduceAmount > availableDeposit) {
      throw AppError.validation(`Cannot reduce ₹${reduceAmount}. Current available deposit is ₹${availableDeposit.toFixed(2)}`);
    }

    const currentBalance = khataRepository.getCurrentBalance(customerId);
    const newBalance = currentBalance + reduceAmount;

    const transaction = khataRepository.create({
      customer_id: customerId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'refund',
      debit: reduceAmount,
      credit: 0,
      balance: Math.round(newBalance * 100) / 100,
      notes: notes || (reason === 'adjustment' ? 'Deposit adjusted / applied' : 'Deposit refund / reduction to customer'),
      user_id: userId
    });

    audit.log(userId, 'KHATA_DEPOSIT_REDUCED', 'khata_transactions', transaction.id,
      `Deposit reduced by ₹${reduceAmount} for ${customer.name}`);

    return { id: transaction.id, balance: newBalance, availableDeposit: Math.max(0, availableDeposit - reduceAmount) };
  }

  deleteTransaction(id, userId) {
    const transaction = khataRepository.findById(id);
    if (!transaction) throw AppError.notFound('Khata transaction');

    return TransactionManager.execute((txDb) => {
      if (transaction.transaction_type === 'bill' && transaction.bill_id) {
        const bill = txDb.prepare('SELECT * FROM bills WHERE id = ?').get(transaction.bill_id);
        if (bill && bill.status === 'active') {
          txDb.prepare(`UPDATE bills SET status = 'cancelled', cancellation_reason = ?, updated_at = ? WHERE id = ?`)
            .run('Removed from khata', new Date().toISOString(), transaction.bill_id);

          const paymentTxns = txDb.prepare(`
            SELECT * FROM khata_transactions WHERE bill_id = ? AND transaction_type = 'payment' ORDER BY id DESC
          `).all(transaction.bill_id);
          for (const pt of paymentTxns) {
            if (pt.payment_id) {
              const allocs = txDb.prepare('SELECT * FROM payment_allocations WHERE payment_id = ?').all(pt.payment_id);
              for (const a of allocs) {
                txDb.prepare('DELETE FROM payment_allocations WHERE id = ?').run(a.id);
              }
              txDb.prepare('DELETE FROM payments WHERE id = ?').run(pt.payment_id);
            }
            txDb.prepare('DELETE FROM khata_transactions WHERE id = ?').run(pt.id);
          }

          const items = txDb.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(transaction.bill_id);
          for (const item of items) {
            if (item.item_type === 'inventory' && item.product_id) {
              const prod = txDb.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
              if (prod) {
                const qtyChange = item.quantity;
                const newQty = prod.quantity_in_stock + qtyChange;
                txDb.prepare(`
                  INSERT INTO inventory_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, bill_id, user_id, notes)
                  VALUES (?, 'returned', ?, ?, ?, ?, ?, 'Bill removed from khata')
                `).run(item.product_id, prod.quantity_in_stock, qtyChange, newQty, transaction.bill_id, userId);
                txDb.prepare('UPDATE products SET quantity_in_stock = ?, updated_at = ? WHERE id = ?')
                  .run(newQty, new Date().toISOString(), item.product_id);
              }
            }
          }
        }
      } else if (transaction.payment_id) {
        const allocations = txDb.prepare('SELECT * FROM payment_allocations WHERE payment_id = ?').all(transaction.payment_id);
        for (const alloc of allocations) {
          txDb.prepare('DELETE FROM payment_allocations WHERE id = ?').run(alloc.id);
          const bill = txDb.prepare('SELECT * FROM bills WHERE id = ?').get(alloc.bill_id);
          if (bill) {
            const newPaid = Math.max(0, (bill.paid_amount || 0) - alloc.amount);
            const newBalance = Math.round((bill.grand_total - newPaid) * 100) / 100;
            const newStatus = newPaid >= bill.grand_total ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
            txDb.prepare('UPDATE bills SET paid_amount = ?, balance_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?')
              .run(newPaid, newBalance, newStatus, new Date().toISOString(), alloc.bill_id);
          }
        }
        txDb.prepare('DELETE FROM payments WHERE id = ?').run(transaction.payment_id);
      }

      txDb.prepare('DELETE FROM khata_transactions WHERE id = ?').run(id);

      const afterId = transaction.transaction_type === 'bill' ? id - 1 : id;
      this._recalculateBalances(txDb, transaction.customer_id, afterId);

      audit.log(userId, 'KHATA_TRANSACTION_DELETED', 'khata_transactions', id,
        `Khata transaction deleted: ${transaction.transaction_type} ${transaction.debit > 0 ? '₹' + transaction.debit : '₹' + transaction.credit}`);

      return { deleted: true };
    });
  }

  updateTransaction(id, data, userId) {
    const transaction = khataRepository.findById(id);
    if (!transaction) throw AppError.notFound('Khata transaction');

    if (transaction.transaction_type === 'bill') {
      throw AppError.invalidOperation('Cannot edit a bill transaction directly. Cancel and recreate the bill instead.');
    }
    return TransactionManager.execute((txDb) => {
      const updates = {};
      if (data.notes !== undefined) {
        updates.notes = validateString(data.notes, 'Notes', 500);
      }
      if (data.transaction_date !== undefined) {
        updates.transaction_date = validateDate(data.transaction_date);
      }

      const isPayment = transaction.transaction_type === 'payment' || transaction.transaction_type === 'adjustment_credit' || transaction.transaction_type === 'deposit';
      const isDebitType = transaction.transaction_type === 'adjustment_debit';
      const isOpeningBal = transaction.transaction_type === 'opening_balance';

      if (data.amount !== undefined && !isNaN(parseFloat(data.amount))) {
        const newAmount = Math.round(parseFloat(data.amount) * 100) / 100;

        if (isOpeningBal) {
          if (newAmount === 0) throw AppError.validation('Opening balance amount must not be zero');
          updates.debit = newAmount > 0 ? newAmount : 0;
          updates.credit = newAmount < 0 ? Math.abs(newAmount) : 0;
        } else {
          if (newAmount <= 0) throw AppError.validation('Amount must be positive');

          if (isPayment || isDebitType) {
          const oldAmount = transaction.transaction_type === 'adjustment_debit' ? transaction.debit : transaction.credit;
          const diff = newAmount - oldAmount;

          if (transaction.payment_id) {
            const allocations = txDb.prepare('SELECT * FROM payment_allocations WHERE payment_id = ?').all(transaction.payment_id);
            for (const alloc of allocations) {
              txDb.prepare('DELETE FROM payment_allocations WHERE id = ?').run(alloc.id);
              const bill = txDb.prepare('SELECT * FROM bills WHERE id = ?').get(alloc.bill_id);
              if (bill) {
                const adjustedPaid = Math.max(0, (bill.paid_amount || 0) - alloc.amount + newAmount);
                const newPaid = Math.min(adjustedPaid, bill.grand_total);
                const newBalance = Math.round((bill.grand_total - newPaid) * 100) / 100;
                const newStatus = newPaid >= bill.grand_total ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
                txDb.prepare('UPDATE bills SET paid_amount = ?, balance_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?')
                  .run(newPaid, newBalance, newStatus, new Date().toISOString(), alloc.bill_id);
                txDb.prepare('INSERT INTO payment_allocations (payment_id, bill_id, amount) VALUES (?, ?, ?)')
                  .run(transaction.payment_id, alloc.bill_id, newAmount);
              }
            }
            txDb.prepare('UPDATE payments SET amount = ?, updated_at = ? WHERE id = ?')
              .run(newAmount, new Date().toISOString(), transaction.payment_id);
          }

          if (transaction.transaction_type === 'adjustment_debit') {
            updates.debit = newAmount;
          } else {
            updates.credit = newAmount;
          }
          }
        }
      }

      if (data.payment_method !== undefined && transaction.transaction_type === 'payment') {
        updates.payment_method = data.payment_method;
        if (transaction.payment_id) {
          txDb.prepare('UPDATE payments SET payment_method = ?, updated_at = ? WHERE id = ?')
            .run(data.payment_method, new Date().toISOString(), transaction.payment_id);
        }
      }

      if (Object.keys(updates).length > 0) {
        txDb.prepare(`UPDATE khata_transactions SET ${Object.keys(updates).map(k => `${k} = ?`).join(', ')} WHERE id = ?`)
          .run(...Object.values(updates), id);

        if (data.amount !== undefined && !isNaN(parseFloat(data.amount))) {
          this._recalculateBalances(txDb, transaction.customer_id, id - 1);
        }
      }

      audit.log(userId, 'KHATA_TRANSACTION_UPDATED', 'khata_transactions', id,
        `Khata transaction ${id} updated`);

      return { updated: true };
    });
  }

  _recalculateBalances(txDb, customerId, afterTransactionId) {
    const transactions = txDb.prepare(`
      SELECT id, debit, credit FROM khata_transactions
      WHERE customer_id = ? AND id > ?
      ORDER BY id ASC
    `).all(customerId, afterTransactionId);

    const prevTxn = txDb.prepare(`
      SELECT balance FROM khata_transactions
      WHERE customer_id = ? AND id < ?
      ORDER BY id DESC LIMIT 1
    `).get(customerId, afterTransactionId + 1);

    let runningBalance = prevTxn ? prevTxn.balance : 0;

    for (const txn of transactions) {
      runningBalance = Math.round((runningBalance + txn.debit - txn.credit) * 100) / 100;
      txDb.prepare('UPDATE khata_transactions SET balance = ? WHERE id = ?').run(runningBalance, txn.id);
    }
  }
}

module.exports = new KhataService();
