const { billRepository, paymentRepository, customerRepository, productRepository } = require('../repositories');
const { AppError } = require('../errors/app-error');
const { validateId, validateAmount, validateEnum, validateString, validateOptionalString, validateDate, validateWeight, validatePercentage } = require('../validation');
const { VALID_BILL_TYPES, VALID_PAYMENT_STATUSES, VALID_PAYMENT_METHODS } = require('../validation/schemas');
const TransactionManager = require('../database/transaction_manager');
const invoiceService = require('./invoice.service');
const audit = require('../logging/audit');

class BillService {
  getById(id) {
    const bill = billRepository.getBillWithItems(id);
    if (!bill) throw AppError.notFound('Bill');
    return bill;
  }

  search(query) {
    return billRepository.search(query);
  }

  cancel(id, data, userId) {
    const bill = billRepository.findById(id);
    if (!bill) throw AppError.notFound('Bill');
    if (bill.status !== 'active') {
      throw AppError.invalidOperation('Bill is already ' + bill.status);
    }

    const reason = data.reason ? validateString(data.reason, 'Cancellation reason', 500) : 'Cancelled by user';

    return TransactionManager.execute((txDb) => {
      txDb.prepare(`
        UPDATE bills SET status = 'cancelled', cancellation_reason = ?, updated_at = ? WHERE id = ?
      `).run(reason, new Date().toISOString(), id);

      if (bill.paid_amount > 0 && bill.balance_amount > 0) {
        txDb.prepare(`
          UPDATE bills SET paid_amount = 0, balance_amount = grand_total, payment_status = 'unpaid', updated_at = ?
          WHERE id = ?
        `).run(new Date().toISOString(), id);
      }

      const items = txDb.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(id);
      for (const item of items) {
        if (item.item_type === 'inventory' && item.product_id) {
          const product = txDb.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
          if (product) {
            const qtyChange = item.quantity;
            const newQty = product.quantity_in_stock + qtyChange;
            txDb.prepare(`
              INSERT INTO inventory_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, bill_id, user_id, notes)
              VALUES (?, 'returned', ?, ?, ?, ?, ?, 'Bill cancelled')
            `).run(item.product_id, product.quantity_in_stock, qtyChange, newQty, id, userId);
            txDb.prepare('UPDATE products SET quantity_in_stock = ?, updated_at = ? WHERE id = ?')
              .run(newQty, new Date().toISOString(), item.product_id);
          }
        }
      }

      audit.log(userId, 'BILL_CANCELLED', 'bill', id, `Bill #${bill.invoice_number} cancelled: ${reason}`);
      return { cancelled: true };
    });
  }

  finalize(data, userId) {
    const customerId = validateId(data.customer_id, 'Customer ID');
    const customer = customerRepository.findById(customerId);
    if (!customer || customer.is_deleted) throw AppError.notFound('Customer');

    const billType = validateEnum(data.bill_type, VALID_BILL_TYPES, 'Bill type');
    const items = data.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      throw AppError.validation('At least one item is required');
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_type || !['inventory', 'manual'].includes(item.item_type)) {
        throw AppError.validation(`Item ${i + 1}: invalid item type`);
      }
      if (!item.description || item.description.trim().length === 0) {
        throw AppError.validation(`Item ${i + 1}: description is required`);
      }
      const qty = parseFloat(item.quantity) || 1;
      if (qty <= 0) throw AppError.validation(`Item ${i + 1}: quantity must be positive`);
      if (item.item_type === 'inventory') {
        if (!item.product_id) throw AppError.validation(`Item ${i + 1}: inventory items require a product selection`);
        const product = productRepository.findById(item.product_id);
        if (!product || product.is_deleted) throw AppError.notFound(`Item ${i + 1} product`);
        if (qty > product.quantity_in_stock && product.quantity_in_stock !== null) {
          throw AppError.validation(`Item ${i + 1}: insufficient stock. Available: ${product.quantity_in_stock}, Required: ${qty}`);
        }
      }
    }

    const paidAmount = validateAmount(data.paid_amount !== undefined ? data.paid_amount : 0, 'Paid amount');
    const grandTotal = validateAmount(data.grand_total !== undefined ? data.grand_total : 0, 'Grand total');
    if (paidAmount > grandTotal) {
      throw AppError.validation('Paid amount cannot exceed grand total');
    }

    const paymentStatus = paidAmount >= grandTotal ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
    const balanceAmount = Math.round((grandTotal - paidAmount) * 100) / 100;

    if (paidAmount > 0) {
      validateEnum(data.payment_method, VALID_PAYMENT_METHODS, 'Payment method');
    }

    const invoiceNumber = invoiceService.reserveInvoiceNumber();
    const billDate = data.bill_date ? validateDate(data.bill_date) : new Date().toISOString().split('T')[0];

    const billData = {
      invoice_number: invoiceNumber,
      bill_type: billType,
      customer_id: customerId,
      user_id: userId,
      bill_date: billDate,
      subtotal: validateAmount(data.subtotal || 0, 'Subtotal'),
      discount_percentage: data.discount_percentage || 0,
      discount_amount: validateAmount(data.discount_amount || 0, 'Discount amount'),
      making_charge_total: validateAmount(data.making_charge_total || 0, 'Making charge total'),
      stone_charge_total: validateAmount(data.stone_charge_total || 0, 'Stone charge total'),
      wastage_total: validateAmount(data.wastage_total || 0, 'Wastage total'),
      taxable_amount: validateAmount(data.taxable_amount || 0, 'Taxable amount'),
      cgst_rate: billType === 'gst' ? (data.cgst_rate || 0) : 0,
      sgst_rate: billType === 'gst' ? (data.sgst_rate || 0) : 0,
      igst_rate: billType === 'gst' ? (data.igst_rate || 0) : 0,
      cgst_amount: validateAmount(data.cgst_amount || 0, 'CGST amount'),
      sgst_amount: validateAmount(data.sgst_amount || 0, 'SGST amount'),
      igst_amount: validateAmount(data.igst_amount || 0, 'IGST amount'),
      tax_total: validateAmount(data.tax_total || 0, 'Tax total'),
      round_off: data.round_off || 0,
      grand_total: grandTotal,
      paid_amount: paidAmount,
      balance_amount: balanceAmount,
      payment_status: paymentStatus,
      khata_before: data.khata_before || 0,
      notes: data.notes || null,
      status: 'active'
    };

    const savedBill = TransactionManager.execute((txDb) => {
      const billResult = txDb.prepare(`
        INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date,
          subtotal, discount_percentage, discount_amount,
          making_charge_total, stone_charge_total, wastage_total,
          taxable_amount,
          cgst_rate, sgst_rate, igst_rate,
          cgst_amount, sgst_amount, igst_amount,
          tax_total, round_off, grand_total,
          paid_amount, balance_amount, payment_status, khata_before, notes, status)
        VALUES (?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?)
      `).run(
        billData.invoice_number, billData.bill_type, billData.customer_id, billData.user_id, billData.bill_date,
        billData.subtotal, billData.discount_percentage, billData.discount_amount,
        billData.making_charge_total, billData.stone_charge_total, billData.wastage_total,
        billData.taxable_amount,
        billData.cgst_rate, billData.sgst_rate, billData.igst_rate,
        billData.cgst_amount, billData.sgst_amount, billData.igst_amount,
        billData.tax_total, billData.round_off, billData.grand_total,
        billData.paid_amount, billData.balance_amount, billData.payment_status, billData.khata_before, billData.notes, billData.status
      );
      const billId = txDb.lastInsertRowid;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const product = item.item_type === 'inventory' && item.product_id ? productRepository.findById(item.product_id) : null;
        const qty = parseFloat(item.quantity) || 1;
        const rate = parseFloat(item.rate) || 0;
        const total = parseFloat(item.total) || 0;
        const makingCharge = parseFloat(item.making_charge) || 0;
        const wastagePct = parseFloat(item.wastage_percentage) || 0;
        const discountPct = parseFloat(item.discount_percentage) || 0;
        const discountAmt = parseFloat(item.discount_amount) || 0;
        const wastageAmt = parseFloat(item.wastage_amount) || 0;
        const taxableAmt = parseFloat(item.taxable_amount) || 0;
        const itemCgstRate = billType === 'gst' ? (item.cgst_rate || billData.cgst_rate) : 0;
        const itemSgstRate = billType === 'gst' ? (item.sgst_rate || billData.sgst_rate) : 0;
        const itemIgstRate = billType === 'gst' ? (item.igst_rate || billData.igst_rate) : 0;
        const itemCgstAmt = parseFloat(item.cgst_amount) || 0;
        const itemSgstAmt = parseFloat(item.sgst_amount) || 0;
        const itemIgstAmt = parseFloat(item.igst_amount) || 0;

        txDb.prepare(`
          INSERT INTO bill_items (bill_id, item_type, product_id, description, category_id, hsn_code,
            metal, purity, gross_weight, net_weight, stone_weight,
            making_charge, wastage_percentage, wastage_amount,
            rate, quantity, discount_percentage, discount_amount,
            taxable_amount,
            cgst_rate, sgst_rate, igst_rate,
            cgst_amount, sgst_amount, igst_amount,
            total, sort_order)
          VALUES (?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?)
        `).run(
          billId, item.item_type, item.product_id || null, item.description,
          item.category_id || (product ? product.category_id : null),
          item.hsn_code || (product ? product.hsn_code : null),
          item.metal || (product ? product.metal : null),
          item.purity || (product ? product.purity : null),
          item.gross_weight !== undefined ? item.gross_weight : (product ? product.gross_weight : null),
          item.net_weight !== undefined ? item.net_weight : (product ? product.net_weight : null),
          item.stone_weight || null,
          makingCharge, wastagePct, wastageAmt,
          rate, qty, discountPct, discountAmt,
          taxableAmt,
          itemCgstRate, itemSgstRate, itemIgstRate,
          itemCgstAmt, itemSgstAmt, itemIgstAmt,
          total, i + 1
        );
      }

      if (paidAmount > 0) {
        const paymentResult = txDb.prepare(`
          INSERT INTO payments (customer_id, user_id, payment_date, amount, payment_method, reference_number, notes, type)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'bill_payment')
        `).run(customerId, userId, billDate, paidAmount, data.payment_method, data.payment_reference || null, data.notes || null);
        const paymentId = txDb.lastInsertRowid;

        txDb.prepare(`
          INSERT INTO payment_allocations (payment_id, bill_id, amount) VALUES (?, ?, ?)
        `).run(paymentId, billId, paidAmount);
      }

      for (const item of items) {
        if (item.item_type === 'inventory' && item.product_id) {
          const prod = txDb.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
          if (prod) {
            const qty = parseFloat(item.quantity) || 1;
            const newQty = Math.max(0, prod.quantity_in_stock - qty);
            txDb.prepare(`
              INSERT INTO inventory_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, bill_id, user_id, notes)
              VALUES (?, 'sold', ?, ?, ?, ?, ?, 'Bill sale')
            `).run(item.product_id, prod.quantity_in_stock, -qty, newQty, billId, userId);
            txDb.prepare('UPDATE products SET quantity_in_stock = ?, updated_at = ? WHERE id = ?')
              .run(newQty, new Date().toISOString(), item.product_id);
          }
        }
      }

      const currentKhata = txDb.prepare(`
        SELECT COALESCE(balance, 0) as balance FROM khata_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1
      `).get(customerId);
      const khataBefore = currentKhata ? currentKhata.balance : 0;
      const khataAfterBill = khataBefore + grandTotal;

      txDb.prepare(`
        INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, bill_id, user_id, notes)
        VALUES (?, ?, 'bill', ?, 0, ?, ?, ?, 'Bill created')
      `).run(customerId, billDate, grandTotal, khataAfterBill, billId, userId);

      if (paidAmount > 0) {
        const khataAfterPayment = Math.max(0, khataAfterBill - paidAmount);
        txDb.prepare(`
          INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, bill_id, user_id, notes)
          VALUES (?, ?, 'payment', 0, ?, ?, ?, ?, 'Payment on bill')
        `).run(customerId, billDate, paidAmount, khataAfterPayment, billId, userId);
      }

      audit.log(userId, 'BILL_CREATED', 'bill', billId, `Created bill ${invoiceNumber} for ₹${grandTotal}`);

      return billId;
    });

    return billRepository.getBillWithItems(savedBill);
  }
}

module.exports = new BillService();
