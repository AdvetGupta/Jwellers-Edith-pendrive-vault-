const { customerRepository } = require('../repositories');
const { getDb } = require('../database/connection');
const TransactionManager = require('../database/transaction_manager');
const { AppError } = require('../errors/app-error');
const { validateString, validatePhone, validateCustomerId, validateSearch } = require('../validation');
const { generateCustomerId } = require('../utils/formatters');
const audit = require('../logging/audit');

const AADHAAR_MASK = '********';

function validateMembershipLevel(membershipLevelId) {
  if (!membershipLevelId) return null;
  const db = getDb();
  const level = db.prepare('SELECT id FROM membership_levels WHERE id = ?').get(membershipLevelId);
  if (!level) throw AppError.validation('Invalid membership level');
  return membershipLevelId;
}

function maskAadhaar(customer) {
  if (!customer) return customer;
  if (customer.aadhaar_number) {
    return { ...customer, aadhaar_number: AADHAAR_MASK };
  }
  return customer;
}

class CustomerService {
  search(query) {
    const result = customerRepository.search(query);
    result.data = result.data.map(maskAadhaar);
    return result;
  }

  getById(id) {
    const customer = customerRepository.findById(id);
    if (!customer || customer.is_deleted) {
      throw AppError.notFound('Customer');
    }
    return maskAadhaar(customer);
  }

  getByCustomerId(customerId) {
    const customer = customerRepository.findByCustomerId(customerId);
    if (!customer || customer.is_deleted) {
      throw AppError.notFound('Customer');
    }
    return maskAadhaar(customer);
  }

  getSummary(id) {
    const summary = customerRepository.getCustomerSummary(id);
    if (!summary || summary.is_deleted) {
      throw AppError.notFound('Customer');
    }
    return maskAadhaar(summary);
  }

  create(data, userId) {
    const name = validateString(data.name, 'Customer name');
    const phone1 = data.phone1 ? (validatePhone(data.phone1) || data.phone1) : null;

    if (data.membership_level_id) {
      validateMembershipLevel(data.membership_level_id);
    }

    let customerId = data.customer_id;
    if (customerId) {
      customerId = validateCustomerId(customerId);
      const existing = customerRepository.findByCustomerId(customerId);
      if (existing) {
        throw AppError.conflict(`Customer ID '${customerId}' already exists`);
      }
    } else {
      const maxNum = customerRepository.getMaxCustomerNumber();
      customerId = generateCustomerId(maxNum + 1);
    }

    const customer = customerRepository.create({
      customer_id: customerId,
      name,
      relation: data.relation ? data.relation.trim() : null,
      phone1: phone1 || null,
      phone2: data.phone2 ? (validatePhone(data.phone2) || data.phone2) : null,
      address: data.address || null,
      city: data.city || null,
      aadhaar_number: data.aadhaar_number || null,
      notes: data.notes || null,
      membership_level_id: data.membership_level_id || null
    });

    audit.log(userId, 'CUSTOMER_CREATED', 'customer', customer.id, `Created customer ${name} (${customerId})`);

    return maskAadhaar(customerRepository.findById(customer.id));
  }

  update(id, data, userId) {
    const existing = this.getById(id);

    if (data.membership_level_id) {
      validateMembershipLevel(data.membership_level_id);
    }

    const updates = {};
    if (data.name !== undefined) updates.name = validateString(data.name, 'Customer name');
    if (data.relation !== undefined) updates.relation = data.relation ? data.relation.trim() : null;
    if (data.phone1 !== undefined) updates.phone1 = data.phone1 ? (validatePhone(data.phone1) || data.phone1) : null;
    if (data.phone2 !== undefined) updates.phone2 = data.phone2 ? (validatePhone(data.phone2) || data.phone2) : null;
    if (data.address !== undefined) updates.address = data.address || null;
    if (data.city !== undefined) updates.city = data.city || null;
    if (data.aadhaar_number !== undefined) updates.aadhaar_number = data.aadhaar_number || null;
    if (data.notes !== undefined) updates.notes = data.notes || null;
    if (data.membership_level_id !== undefined) updates.membership_level_id = data.membership_level_id || null;

    if (data.customer_id !== undefined && data.customer_id !== existing.customer_id) {
      const newId = validateCustomerId(data.customer_id);
      const dup = customerRepository.findByCustomerId(newId);
      if (dup) throw AppError.conflict(`Customer ID '${newId}' already exists`);
      updates.customer_id = newId;
    }

    updates.updated_at = new Date().toISOString();
    customerRepository.update(id, updates);

    audit.log(userId, 'CUSTOMER_UPDATED', 'customer', id, `Updated customer ${updates.name || existing.name}`);

    return maskAadhaar(customerRepository.findById(id));
  }

  getNextId() {
    const maxNum = customerRepository.getMaxCustomerNumber();
    return generateCustomerId(maxNum + 1);
  }

  realignQueue(userId, sortBy = 'date_asc') {
    const db = getDb();
    let orderSql = 'ORDER BY id ASC';
    if (sortBy === 'name_asc') {
      orderSql = 'ORDER BY LOWER(name) ASC, id ASC';
    } else if (sortBy === 'name_desc') {
      orderSql = 'ORDER BY LOWER(name) DESC, id ASC';
    } else if (sortBy === 'city_asc') {
      orderSql = "ORDER BY CASE WHEN city IS NULL OR TRIM(city) = '' THEN 1 ELSE 0 END, LOWER(city) ASC, LOWER(name) ASC, id ASC";
    } else if (sortBy === 'date_desc') {
      orderSql = 'ORDER BY id DESC';
    } else {
      orderSql = 'ORDER BY id ASC';
    }
    const rows = db.prepare(`SELECT id, customer_id FROM customers WHERE is_deleted = 0 ${orderSql}`).all();
    if (!rows || rows.length === 0) return { count: 0 };

    TransactionManager.execute((txDb) => {
      txDb.prepare("UPDATE customers SET customer_id = '__TEMP_' || id").run();
      const updateStmt = txDb.prepare("UPDATE customers SET customer_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
      rows.forEach((r, idx) => {
        const sequentialId = generateCustomerId(idx + 1);
        updateStmt.run(sequentialId, r.id);
      });
      txDb.prepare("UPDATE customers SET customer_id = 'DEL-' || id WHERE is_deleted = 1").run();
    });

    audit.log(userId, 'CUSTOMERS_REALIGNED', 'customer', null, `Re-aligned ${rows.length} customer IDs into sequential queue sorted by ${sortBy}`);
    return { count: rows.length };
  }

  archive(id, userId) {
    const existing = this.getById(id);
    customerRepository.update(id, { is_archived: 1, updated_at: new Date().toISOString() });
    audit.log(userId, 'CUSTOMER_ARCHIVED', 'customer', id, `Archived customer ${existing.name}`);
    return { archived: true };
  }

  unarchive(id, userId) {
    const existing = this.getById(id);
    customerRepository.update(id, { is_archived: 0, updated_at: new Date().toISOString() });
    audit.log(userId, 'CUSTOMER_UNARCHIVED', 'customer', id, `Unarchived customer ${existing.name}`);
    return { unarchived: true };
  }

  softDelete(id, userId) {
    const existing = this.getById(id);
    customerRepository.update(id, { is_deleted: 1, updated_at: new Date().toISOString() });
    audit.log(userId, 'CUSTOMER_DELETED', 'customer', id, `Deleted customer ${existing.name}`);
    return { deleted: true };
  }

  getCounts() {
    return customerRepository.getCounts();
  }

  verifyIntegrity() {
    const db = getDb();
    const counts = customerRepository.getCounts();
    const issuesFound = [];

    const deletedRow = db.prepare('SELECT COUNT(*) as count FROM customers WHERE is_deleted = 1').get();
    const deletedCount = deletedRow ? deletedRow.count : 0;

    // Check for duplicate customer_ids
    const duplicates = db.prepare(`
      SELECT customer_id, COUNT(*) as cnt FROM customers
      WHERE is_deleted = 0
      GROUP BY customer_id HAVING cnt > 1
    `).all();

    if (duplicates.length > 0) {
      issuesFound.push(`Found ${duplicates.length} duplicate Customer ID(s): ${duplicates.map(d => d.customer_id).join(', ')}`);
    }

    // Check for missing names
    const missingNames = db.prepare(`
      SELECT COUNT(*) as count FROM customers
      WHERE is_deleted = 0 AND (name IS NULL OR TRIM(name) = '')
    `).get();

    if (missingNames && missingNames.count > 0) {
      issuesFound.push(`Found ${missingNames.count} customer(s) with missing or empty names`);
    }

    // Check for orphan bills
    const orphanBills = db.prepare(`
      SELECT COUNT(*) as count FROM bills b
      LEFT JOIN customers c ON c.id = b.customer_id
      WHERE c.id IS NULL
    `).get();

    if (orphanBills && orphanBills.count > 0) {
      issuesFound.push(`Found ${orphanBills.count} bill(s) referencing non-existent customers`);
    }

    // Check for orphan khata transactions
    const orphanKhata = db.prepare(`
      SELECT COUNT(*) as count FROM khata_transactions k
      LEFT JOIN customers c ON c.id = k.customer_id
      WHERE c.id IS NULL
    `).get();

    if (orphanKhata && orphanKhata.count > 0) {
      issuesFound.push(`Found ${orphanKhata.count} khata transaction(s) referencing non-existent customers`);
    }

    return {
      healthy: issuesFound.length === 0,
      totalCustomers: counts.total,
      activeCustomers: counts.active,
      archivedCustomers: counts.archived,
      deletedCustomers: deletedCount,
      issuesFound,
      checkedAt: new Date().toISOString()
    };
  }
}

module.exports = new CustomerService();
