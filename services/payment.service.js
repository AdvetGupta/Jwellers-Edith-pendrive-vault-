const { paymentRepository, billRepository, customerRepository } = require('../repositories');
const { AppError } = require('../errors/app-error');
const { validateId, validateAmount, validateEnum, validateString, validateOptionalString, validateDate } = require('../validation');
const { VALID_PAYMENT_METHODS, VALID_PAYMENT_TYPES } = require('../validation/schemas');
const audit = require('../logging/audit');

class PaymentService {
  create(data, userId) {
    const customerId = validateId(data.customer_id, 'Customer ID');
    const customer = customerRepository.findById(customerId);
    if (!customer || customer.is_deleted) {
      throw AppError.notFound('Customer');
    }

    const amount = validateAmount(data.amount, 'Payment amount');
    if (amount <= 0) {
      throw AppError.validation('Payment amount must be positive');
    }

    const paymentMethod = validateEnum(data.payment_method, VALID_PAYMENT_METHODS, 'Payment method');
    const paymentDate = data.payment_date ? validateDate(data.payment_date) : new Date().toISOString().split('T')[0];
    const referenceNumber = data.reference_number || null;
    const notes = data.notes || null;
    const billId = data.bill_id ? validateId(data.bill_id, 'Bill ID') : null;

    const payment = paymentRepository.create({
      customer_id: customerId,
      user_id: userId,
      payment_date: paymentDate,
      amount,
      payment_method: paymentMethod,
      reference_number: referenceNumber,
      notes,
      type: 'bill_payment'
    });

    if (billId) {
      const bill = billRepository.findById(billId);
      if (!bill) throw AppError.notFound('Bill');

      paymentRepository.getDb().prepare(`
        INSERT INTO payment_allocations (payment_id, bill_id, amount) VALUES (?, ?, ?)
      `).run(payment.id, billId, amount);

      const totalPaid = paymentRepository.getTotalPaidForBill(billId);
      const newPaid = Math.min(totalPaid, bill.grand_total);
      const balance = bill.grand_total - newPaid;
      const status = balance <= 0 ? 'paid' : 'partial';

      billRepository.update(billId, {
        paid_amount: newPaid,
        balance_amount: balance,
        payment_status: status,
        updated_at: new Date().toISOString()
      });
    }

    const currentKhata = paymentRepository.getDb().prepare(`
      SELECT COALESCE(balance, 0) as balance FROM khata_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1
    `).get(customerId);
    const khataBefore = currentKhata ? currentKhata.balance : 0;
    const khataAfter = Math.max(0, khataBefore - amount);

    paymentRepository.getDb().prepare(`
      INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, payment_id, bill_id, user_id, notes)
      VALUES (?, ?, 'payment', 0, ?, ?, ?, ?, ?, ?)
    `).run(customerId, paymentDate, amount, khataAfter, payment.id, billId, userId, notes || 'Payment received');

    audit.log(userId, 'PAYMENT_CREATED', 'payment', payment.id,
      `Payment of ₹${amount} recorded for ${customer.name} (${paymentMethod})`);

    return paymentRepository.findById(payment.id);
  }

  search(query) {
    return paymentRepository.search(query);
  }

  getForBill(billId) {
    const bill = billRepository.findById(billId);
    if (!bill) throw AppError.notFound('Bill');

    const allocations = paymentRepository.getDb().prepare(`
      SELECT pa.*, p.payment_date, p.payment_method, p.reference_number, p.notes, p.created_at
      FROM payment_allocations pa
      JOIN payments p ON p.id = pa.payment_id
      WHERE pa.bill_id = ?
      ORDER BY pa.created_at ASC
    `).all(billId);

    return allocations;
  }
}

module.exports = new PaymentService();
