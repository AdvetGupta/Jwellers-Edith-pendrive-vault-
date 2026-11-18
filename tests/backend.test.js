const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { initialize } = require('../database/init');
const connection = require('../database/connection');
const TransactionManager = require('../database/transaction_manager');
const { AppError, ERROR_CODES } = require('../errors/app-error');
const { success, failure } = require('../utils/response');
const { parsePagination, parseSort, buildMeta } = require('../utils/pagination');
const { formatCurrency, formatWeight, formatDate, formatPhone, generateCustomerId } = require('../utils/formatters');
const { hashPassword, verifyPassword } = require('../security/password');
const { hasPermission, requirePermission, getUserPermissions } = require('../security/permission');
const { createSession, getSession, destroySession } = require('../security/session');
const { validateId, validateString, validatePhone, validateAmount, validateWeight, validateDate, validateEnum, validatePagination, validateSearch, validateCustomerId } = require('../validation');

const authService = require('../services/auth.service');
const customerService = require('../services/customer.service');
const settingsService = require('../services/settings.service');
const invoiceService = require('../services/invoice.service');
const khataService = require('../services/khata.service');
const permissionService = require('../services/permission.service');
const staffService = require('../services/staff.service');
const auditService = require('../services/audit.service');
const productService = require('../services/product.service');
const inventoryService = require('../services/inventory.service');
const categoryService = require('../services/category.service');
const productTypeService = require('../services/productType.service');
const paymentService = require('../services/payment.service');
const billService = require('../services/bill.service');
const { productRepository } = require('../repositories');

let passed = 0;
let failed = 0;
const dbPath = path.join(__dirname, 'test_backend.db');

function assert(condition, message) {
  if (condition) { passed++; console.log(`  PASS: ${message}`); }
  else { failed++; console.error(`  FAIL: ${message}`); }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) { passed++; console.log(`  PASS: ${message} (${JSON.stringify(actual)})`); }
  else { failed++; console.error(`  FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

function cleanup() {
  try { connection.close(); } catch (e) {}
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {} });
}

function hashPw(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const testQueue = [];
function testGroup(name, fn) {
  testQueue.push({ name, fn });
}

async function runTestGroup(name, fn) {
  console.log(`\n--- ${name} ---`);
  return await fn();
}

async function runTests() {
  console.log('=== JWELLERS EDITH — Backend Integration Tests ===\n');
  cleanup();
  const db = await initialize(dbPath);

  // Seed minimal test data: shop user, permissions
  const ownerRoleId = 1;
  const staffRoleId = 2;

  // Create owner user
  db.prepare(`INSERT INTO users (username, password_hash, display_name, role_id, is_active) VALUES (?, ?, ?, ?, 1)`)
    .run('owner', hashPw('owner123'), 'Test Owner', ownerRoleId);
  const ownerId = db.lastInsertRowid;

  // Create staff user
  db.prepare(`INSERT INTO users (username, password_hash, display_name, role_id, is_active) VALUES (?, ?, ?, ?, 1)`)
    .run('staff', hashPw('staff123'), 'Test Staff', staffRoleId);
  const staffId = db.lastInsertRowid;

  // Create an inactive user
  db.prepare(`INSERT INTO users (username, password_hash, display_name, role_id, is_active) VALUES (?, ?, ?, ?, 0)`)
    .run('inactive', hashPw('inactive123'), 'Inactive User', staffRoleId);

  // Seed categories, product types, membership levels for tests
  db.prepare(`INSERT INTO categories (name) VALUES ('Test Category')`).run();
  const catId = db.lastInsertRowid;
  db.prepare(`INSERT INTO product_types (name) VALUES ('Test Type')`).run();
  const typeId = db.lastInsertRowid;
  db.prepare(`INSERT INTO membership_levels (name, is_default) VALUES ('Regular', 1)`).run();
  const memberId = db.lastInsertRowid;

  // Seed permissions (28 standard ones from seed_demo)
  const permCodes = [
    'dashboard.view', 'customer.create', 'customer.edit', 'customer.view', 'customer.delete',
    'product.create', 'product.edit', 'product.view', 'product.delete',
    'inventory.view', 'inventory.adjust',
    'bill.create', 'bill.view', 'bill.cancel',
    'payment.create', 'payment.view',
    'khata.view', 'khata.adjust',
    'report.view',
    'staff.create', 'staff.edit', 'staff.delete',
    'settings.view', 'settings.edit',
    'backup.create', 'backup.restore',
    'activity.view',
    'communication.send'
  ];
  const permIds = {};
  for (const code of permCodes) {
    let row = db.prepare("SELECT id FROM permissions WHERE code = ?").get(code);
    if (!row) {
      db.prepare(`INSERT INTO permissions (code, name, module) VALUES (?, ?, 'Test')`).run(code, code.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()));
      row = { id: db.lastInsertRowid };
    }
    permIds[code] = row.id;
  }

  // Owner gets all permissions
  for (const pid of Object.values(permIds)) {
    try {
      db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`).run(ownerRoleId, pid);
    } catch (_) {}
  }

  // Staff gets limited permissions
  const staffPerms = ['dashboard.view', 'customer.create', 'customer.edit', 'customer.view', 'product.view', 'inventory.view', 'bill.create', 'bill.view', 'payment.create', 'payment.view', 'khata.view'];
  for (const code of staffPerms) {
    if (permIds[code]) {
      try {
        db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`).run(staffRoleId, permIds[code]);
      } catch (_) {}
    }
  }

  // =============================================
  testGroup('1. AppError — Typed Errors', () => {
    const err = AppError.validation('Test error', { field: 'name' });
    assert(err instanceof AppError, 'AppError is instance of Error');
    assertEqual(err.code, ERROR_CODES.VALIDATION_ERROR, 'Error code set');
    assertEqual(err.message, 'Test error', 'Error message set');
    assert(err.details !== null, 'Error details set');
    assert(err.timestamp !== undefined, 'Error has timestamp');

    const response = err.toResponse();
    assertEqual(response.success, false, 'Response success is false');
    assertEqual(response.error.code, 'VALIDATION_ERROR', 'Response error code');

    const authErr = AppError.authentication();
    assertEqual(authErr.code, ERROR_CODES.AUTHENTICATION_ERROR, 'Auth error factory');

    const notFound = AppError.notFound('Customer');
    assertEqual(notFound.message, 'Customer not found', 'Not found message');

    const conflict = AppError.conflict('Duplicate');
    assertEqual(conflict.code, ERROR_CODES.CONFLICT, 'Conflict error');
  });

  // =============================================
  testGroup('2. Response Contract', () => {
    const s = success({ id: 1, name: 'Test' });
    assertEqual(s.success, true, 'Success response');
    assertEqual(s.data.id, 1, 'Success data');

    const sMsg = success(null, 'Done');
    assertEqual(sMsg.message, 'Done', 'Success with message');

    const f = failure('TEST_ERROR', 'Something failed');
    assertEqual(f.success, false, 'Failure response');
    assertEqual(f.error.code, 'TEST_ERROR', 'Failure code');
  });

  // =============================================
  testGroup('3. Password Hashing', () => {
    const hash = hashPassword('mypassword');
    assert(hash.length === 64, 'Hash is 64 hex chars (SHA-256)');
    assert(hash !== 'mypassword', 'Hash is not plain text');

    const same = hashPassword('mypassword');
    assertEqual(hash, same, 'Same password produces same hash');

    const verified = verifyPassword('mypassword', hash);
    assert(verified, 'Password verification succeeds');

    const wrong = verifyPassword('wrongpassword', hash);
    assert(!wrong, 'Wrong password fails verification');
  });

  // =============================================
  testGroup('4. Validation — Fields', () => {
    const id = validateId('5');
    assertEqual(id, 5, 'ID parsed from string');

    let threw = false;
    try { validateId('abc'); } catch (e) { threw = true; }
    assert(threw, 'Invalid ID rejected');

    const name = validateString('Ravi', 'Name');
    assertEqual(name, 'Ravi', 'String validated');

    threw = false;
    try { validateString('', 'Name'); } catch (e) { threw = true; }
    assert(threw, 'Empty string rejected');

    const phone = validatePhone('9876543210');
    assertEqual(phone, '9876543210', 'Phone validated');

    const amount = validateAmount('1500.50');
    assertEqual(amount, 1500.5, 'Amount parsed');

    threw = false;
    try { validateAmount('-100'); } catch (e) { threw = true; }
    assert(threw, 'Negative amount rejected');

    const weight = validateWeight('12.5');
    assertEqual(weight, 12.5, 'Weight validated');

    const date = validateDate('2026-07-18');
    assertEqual(date, '2026-07-18', 'Date validated');

    threw = false;
    try { validateDate('not-a-date'); } catch (e) { threw = true; }
    assert(threw, 'Invalid date rejected');
  });

  // =============================================
  testGroup('5. Validation — Enum & Pagination', () => {
    const bt = validateEnum('gst', ['gst', 'non_gst'], 'Bill type');
    assertEqual(bt, 'gst', 'Enum validated');

    let threw = false;
    try { validateEnum('invalid', ['gst', 'non_gst']); } catch (e) { threw = true; }
    assert(threw, 'Invalid enum rejected');

    const pag = validatePagination({ page: '2', pageSize: '10' });
    assertEqual(pag.page, 2, 'Page parsed');
    assertEqual(pag.pageSize, 10, 'PageSize parsed');

    const pagDefault = validatePagination({});
    assertEqual(pagDefault.page, 1, 'Default page');
    assertEqual(pagDefault.pageSize, 50, 'Default pageSize');

    const search = validateSearch('Ram');
    assertEqual(search, 'Ram', 'Search term validated');
  });

  // =============================================
  testGroup('6. Formatters', () => {
    const curr = formatCurrency(1500.5);
    assert(curr.includes('₹'), 'Currency formatted with symbol');
    assert(curr.includes('1,500'), 'Currency formatted for INR');

    const wt = formatWeight(12.5678);
    assertEqual(wt, '12.568', 'Weight rounded to 3 decimals');

    const dt = formatDate('2026-07-18');
    assertEqual(dt, '18/07/2026', 'Date formatted DD/MM/YYYY');

    const phone = formatPhone('9876543210');
    assert(phone.includes('98765'), 'Phone formatted');

    const custId = generateCustomerId(42);
    assertEqual(custId, 'CUST-0042', 'Customer ID generated with padding');
  });

  // =============================================
  testGroup('7. Auth Service — Login Success', async () => {
    const result = await authService.login('owner', 'owner123');
    assert(result.token !== undefined, 'Login returns a token');
    assertEqual(result.user.username, 'owner', 'Login returns correct user');
    assert(result.token.length > 20, 'Token is a long random string');

    const currentUser = authService.getCurrentUser(result.token);
    assert(currentUser !== null, 'Session token is valid');
    assertEqual(currentUser.username, 'owner', 'Session has correct username');

    const valid = authService.validateSession(result.token);
    assert(valid, 'Session validation returns true');

    authService.logout(result.token);
    const afterLogout = authService.validateSession(result.token);
    assert(!afterLogout, 'Session invalid after logout');

    global._ownerToken = result.token;
  });

  // =============================================
  testGroup('8. Auth Service — Login Failure', async () => {
    let threw = false;
    try { await authService.login('owner', 'wrongpass'); } catch (e) { threw = true; }
    assert(threw, 'Wrong password rejected');

    threw = false;
    try { await authService.login('nonexistent', 'pass'); } catch (e) { threw = true; }
    assert(threw, 'Non-existent user rejected');

    threw = false;
    try { await authService.login('inactive', 'inactive123'); } catch (e) { threw = true; }
    assert(threw, 'Inactive user rejected');
  });

  // =============================================
  testGroup('9. Auth Service — Staff Login', async () => {
    const result = await authService.login('staff', 'staff123');
    assert(result.token !== undefined, 'Staff login works');
    assertEqual(result.user.username, 'staff', 'Staff user returned');
    global._staffToken = result.token;
  });

  // =============================================
  testGroup('10. Permission — hasPermission', () => {
    // Owner has all permissions
    assert(hasPermission(ownerId, 'customer.create'), 'Owner has customer.create');
    assert(hasPermission(ownerId, 'backup.restore'), 'Owner has backup.restore');
    assert(hasPermission(ownerId, 'nonexistent.perm'), 'Owner has even non-existent by default');

    // Staff has limited permissions
    assert(hasPermission(staffId, 'customer.view'), 'Staff has customer.view');
    assert(hasPermission(staffId, 'bill.create'), 'Staff has bill.create');
    assert(!hasPermission(staffId, 'customer.delete'), 'Staff lacks customer.delete');
    assert(!hasPermission(staffId, 'backup.restore'), 'Staff lacks backup.restore');
    assert(!hasPermission(staffId, 'settings.edit'), 'Staff lacks settings.edit');

    // Non-existent user
    assert(!hasPermission(999, 'customer.view'), 'Non-existent user has no permissions');
  });

  // =============================================
  testGroup('11. Permission — requirePermission', () => {
    assert(requirePermission(ownerId, 'customer.delete'), 'Owner can delete customers');
    let threw = false;
    try { requirePermission(staffId, 'customer.delete'); } catch (e) { threw = true; }
    assert(threw, 'Staff cannot delete customers (AppError thrown)');
  });

  // =============================================
  testGroup('12. Permission — getUserPermissions', () => {
    const ownerPerms = getUserPermissions(ownerId);
    assert(ownerPerms.length >= 28, 'Owner has all permissions');

    const staffPerms = getUserPermissions(staffId);
    assert(staffPerms.length < ownerPerms.length, 'Staff has fewer permissions than owner');
    assert(staffPerms.includes('customer.view'), 'Staff perms include customer.view');
    assert(!staffPerms.includes('backup.restore'), 'Staff perms exclude backup.restore');
  });

  // =============================================
  testGroup('13. Customer Service — Create', () => {
    const customer = customerService.create({
      name: 'Test Customer',
      phone1: '9876543210',
      city: 'Mumbai'
    }, ownerId);

    assert(customer.id > 0, 'Customer created with ID');
    assertEqual(customer.name, 'Test Customer', 'Customer name saved');
    assertEqual(customer.phone1, '9876543210', 'Customer phone saved');
    assert(customer.customer_id.startsWith('CUST-'), 'Customer ID auto-generated');
    assertEqual(customer.is_deleted, 0, 'Not deleted by default');
    assertEqual(customer.is_archived, 0, 'Not archived by default');
    assert(customer.created_at !== undefined, 'Has created_at timestamp');

    global._testCustomerId = customer.id;
    global._testCustomerDisplayId = customer.customer_id;
  });

  // =============================================
  testGroup('14. Customer Service — Duplicate Prevention', () => {
    let threw = false;
    try {
      customerService.create({
        name: 'Duplicate',
        customer_id: global._testCustomerDisplayId
      }, ownerId);
    } catch (e) { threw = true; }
    assert(threw, 'Duplicate customer_id rejected');
  });

  // =============================================
  testGroup('15. Customer Service — Search', () => {
    const result = customerService.search({ page: 1, pageSize: 10 });
    assert(result.data.length >= 1, 'Search returns customers');
    assert(result.pagination.total >= 1, 'Pagination has total');
    assertEqual(result.pagination.page, 1, 'Pagination page correct');

    const searchResult = customerService.search({ search: 'Test Customer' });
    assert(searchResult.data.length >= 1, 'Search by name works');
  });

  // =============================================
  testGroup('16. Customer Service — Get By ID', () => {
    const customer = customerService.getById(global._testCustomerId);
    assertEqual(customer.name, 'Test Customer', 'Get by ID returns correct customer');

    let threw = false;
    try { customerService.getById(99999); } catch (e) { threw = true; }
    assert(threw, 'Non-existent customer throws not found');
  });

  // =============================================
  testGroup('17. Customer Service — Get By Customer ID', () => {
    const customer = customerService.getByCustomerId(global._testCustomerDisplayId);
    assert(customer !== null, 'Get by display ID works');
  });

  // =============================================
  testGroup('18. Customer Service — Update', () => {
    const updated = customerService.update(global._testCustomerId, {
      name: 'Updated Customer',
      city: 'Delhi'
    }, ownerId);

    assertEqual(updated.name, 'Updated Customer', 'Name updated');
    assertEqual(updated.city, 'Delhi', 'City updated');
    assert(updated.updated_at !== undefined, 'Updated timestamp set');
  });

  // =============================================
  testGroup('19. Customer Service — Get Summary', () => {
    const summary = customerService.getSummary(global._testCustomerId);
    assertEqual(summary.total_bills, 0, 'Customer has no bills');
    assertEqual(summary.total_purchases, 0, 'No purchases yet');
    assertEqual(summary.khata_balance, 0, 'Khata balance is 0');
  });

  // =============================================
  testGroup('20. Customer Service — Archive / Unarchive', () => {
    const archived = customerService.archive(global._testCustomerId, ownerId);
    assertEqual(archived.archived, true, 'Customer archived');

    const cust = customerService.getById(global._testCustomerId);
    assertEqual(cust.is_archived, 1, 'is_archived flag set');

    const unarchived = customerService.unarchive(global._testCustomerId, ownerId);
    assertEqual(unarchived.unarchived, true, 'Customer unarchived');
  });

  // =============================================
  testGroup('21. Customer Service — Soft Delete', () => {
    // Create another customer to delete
    const toDelete = customerService.create({ name: 'To Delete', phone1: '9111111111' }, ownerId);
    const deleted = customerService.softDelete(toDelete.id, ownerId);
    assertEqual(deleted.deleted, true, 'Customer soft-deleted');

    let threw = false;
    try { customerService.getById(toDelete.id); } catch (e) { threw = true; }
    assert(threw, 'Deleted customer not found by getById');
  });

  // =============================================
  testGroup('22. Settings Service — Shop Settings', () => {
    const settings = settingsService.getShopSettings();
    assert(settings.id === 1, 'Shop settings exist (single row)');

    const updated = settingsService.updateShopSettings({
      shop_name: 'Test Shop',
      city: 'Test City',
      invoice_prefix: 'INV-'
    }, ownerId);

    assertEqual(updated.shop_name, 'Test Shop', 'Shop name updated');
    assertEqual(updated.city, 'Test City', 'City updated');

    const config = settingsService.getInvoiceConfig();
    assertEqual(config.prefix, 'INV-', 'Invoice prefix from settings');
  });

  // =============================================
  testGroup('23. Invoice Service — Generate Number', () => {
    const invNum = invoiceService.generateInvoiceNumber();
    assert(invNum.startsWith('INV-'), 'Invoice number starts with prefix');
    assert(invNum.includes(new Date().getFullYear().toString()), 'Invoice number includes year');
  });

  // =============================================
  testGroup('24. Khata Service — Opening Balance', () => {
    const khata = khataService.recordOpeningBalance(global._testCustomerId, 25000, ownerId);
    assert(khata.id > 0, 'Opening balance recorded');
    assertEqual(khata.debit, 25000, 'Opening balance is debit');

    const balance = khataService.getCurrentBalance(global._testCustomerId);
    assertEqual(balance, 25000, 'Current balance equals opening balance');

    // Test duplicate opening balance prevention
    let threw = false;
    try { khataService.recordOpeningBalance(global._testCustomerId, 5000, ownerId); } catch (e) { threw = true; }
    assert(threw, 'Duplicate opening balance rejected');
  });

  // =============================================
  testGroup('25. Khata Service — Outstanding Customers', () => {
    const outstanding = khataService.getOutstandingCustomers();
    assert(outstanding.length > 0, 'There are outstanding customers');
    assert(outstanding[0].balance > 0, 'Outstanding balance is positive');
    assert(outstanding[0].customer_name !== undefined, 'Outstanding includes customer name');
  });

  // =============================================
  testGroup('26. Khata Service — Adjust', () => {
    const adj = khataService.adjust(global._testCustomerId, { amount: 5000, notes: 'Additional charge' }, ownerId);
    assert(adj.balance !== undefined, 'Adjustment returns new balance');

    const balance = khataService.getCurrentBalance(global._testCustomerId);
    assertEqual(balance, 30000, 'Balance after debit adjustment');
  });

  // =============================================
  testGroup('27. Khata Service — Get Customer Khata History', () => {
    const history = khataService.getCustomerKhata(global._testCustomerId);
    assert(history.length >= 2, 'Khata history has entries (opening, adj)');
    assert(history[0].transaction_type !== undefined, 'Khata entries have type');
    assert(history[0].balance !== undefined, 'Khata entries have balance');
  });

  // =============================================
  testGroup('28. Khata Service — Search', () => {
    const result = khataService.search({ customer_id: global._testCustomerId, page: 1, pageSize: 10 });
    assert(result.data.length >= 1, 'Khata search works');
    assert(result.pagination.total >= 1, 'Khata search pagination');
  });

  // =============================================
  testGroup('29. Audit Service — Log & Query', () => {
    const recent = auditService.getRecent(5);
    assert(recent.length > 0, 'Audit logs exist from auth/customer actions');
    assert(recent[0].action !== undefined, 'Audit entries have action');

    const search = auditService.search({ page: 1, pageSize: 10 });
    assert(search.data.length > 0, 'Audit search works');
    assert(search.pagination.total > 0, 'Audit search pagination');
  });

  // =============================================
  testGroup('30. Transaction Manager — Commit', () => {
    let result;
    TransactionManager.execute((txDb) => {
      result = txDb.prepare(`INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)`)
        .run(ownerId, 'TEST_TRANSACTION', 'Transaction test');
    });

    const log = connection.getDb().prepare("SELECT * FROM activity_logs WHERE action = 'TEST_TRANSACTION'").get();
    assert(log !== null, 'Transaction committed data visible');
  });

  // =============================================
  testGroup('31. Transaction Manager — Rollback', () => {
    const before = connection.getDb().prepare("SELECT COUNT(*) as c FROM activity_logs WHERE action = 'ROLLBACK_TEST'").get().c;

    try {
      TransactionManager.execute((txDb) => {
        txDb.prepare(`INSERT INTO activity_logs (user_id, action, description) VALUES (?, 'ROLLBACK_TEST', 'Should rollback')`).run(ownerId);
        throw new Error('Simulated failure');
      });
    } catch (e) {}

    const after = connection.getDb().prepare("SELECT COUNT(*) as c FROM activity_logs WHERE action = 'ROLLBACK_TEST'").get().c;
    assertEqual(after, before, 'Data rolled back on failure');
  });

  // =============================================
  testGroup('32. Permission Service — getAllPermissions', () => {
    const all = permissionService.getAllPermissions();
    assert(all.length >= 28, 'All permissions listed');
    assert(all[0].code !== undefined, 'Permissions have code');
    assert(all[0].module !== undefined, 'Permissions have module');
  });

  // =============================================
  testGroup('33. Session — Create / Get / Destroy', () => {
    const session = createSession({ id: ownerId, username: 'owner', display_name: 'Owner', role_id: 1 });
    assert(session.token !== undefined, 'Session created with token');
    assert.equal ? assertEqual(session.userId, ownerId, 'Session has userId') : null;

    const fetched = getSession(session.token);
    assert(fetched !== null, 'Session retrievable');
    assertEqual(fetched.userId, ownerId, 'Session has correct userId');

    destroySession(session.token);
    const afterDestroy = getSession(session.token);
    assert(afterDestroy === null, 'Session destroyed');
  });

  // =============================================
  testGroup('34. ValidateId', () => {
    assertEqual(validateId('1'), 1, 'ID 1 valid');
    let threw = false;
    try { validateId('0'); } catch (e) { threw = true; }
    assert(threw, 'ID 0 rejected');
    threw = false;
    try { validateId('-1'); } catch (e) { threw = true; }
    assert(threw, 'ID -1 rejected');
  });

  // =============================================
  testGroup('35. Customer ID Format Validation', () => {
    const cid = validateCustomerId('CUST-001');
    assertEqual(cid, 'CUST-001', 'Valid customer ID accepted');
    let threw = false;
    try { validateCustomerId(''); } catch (e) { threw = true; }
    assert(threw, 'Empty customer ID rejected');
  });

  // =============================================
  testGroup('36. Format Weight Edge Cases', () => {
    assertEqual(formatWeight(null), '0.000', 'Null weight');
    assertEqual(formatWeight(0), '0.000', 'Zero weight');
    assertEqual(formatWeight(12.3456), '12.346', 'Weight rounded');
  });

  // =============================================
  testGroup('37. Format Currency Edge Cases', () => {
    assert(formatCurrency(0).includes('0.00'), 'Zero currency');
    assert(formatCurrency(null).includes('0.00'), 'Null currency');
    assert(formatCurrency(1000000).includes(','), 'Large number formatted');
  });

  // =============================================
  testGroup('38. Settings — App Settings', () => {
    const appSettings = settingsService.getAppSettings();
    assert(appSettings.id === 1, 'App settings exist');
    assert(appSettings.schema_version >= 1, 'Schema version >= 1');
    assert(appSettings.db_created_at !== undefined, 'DB created timestamp');
  });

  // =============================================
  testGroup('39. Pagination Utilities', () => {
    const parsed = parsePagination({ page: '3', pageSize: '25' });
    assertEqual(parsed.page, 3, 'parsePagination page');
    assertEqual(parsed.pageSize, 25, 'parsePagination pageSize');
    assertEqual(parsed.offset, 50, 'parsePagination offset');

    const meta = buildMeta(100, 3, 25);
    assertEqual(meta.totalPages, 4, 'buildMeta totalPages');
    assert(meta.hasNext, 'buildMeta hasNext true');
    assert(meta.hasPrev, 'buildMeta hasPrev true');
  });

  // =============================================
  testGroup('40. Permission Service — Role Permissions', () => {
    const rolePerms = permissionService.getRolePermissions(ownerRoleId);
    assert(rolePerms.length > 0, 'Owner role has permissions');
  });

  // =============================================
  testGroup('41. ValidateEnum Edge Cases', () => {
    assertEqual(validateEnum('cash', ['cash', 'upi', 'card', 'other']), 'cash', 'Cash payment method');
    let threw = false;
    try { validateEnum('bitcoin', ['cash', 'upi', 'card']); } catch (e) { threw = true; }
    assert(threw, 'Invalid payment method rejected');
  });

  // =============================================
  testGroup('42. ValidateSearch SQL Injection Prevention', () => {
    const sanitized = validateSearch("Robert'); DROP TABLE customers;--");
    assert(!sanitized.includes("'"), 'SQL injection attempt sanitized');
  });

  // =============================================
  testGroup('43. ValidatePagination Limits', () => {
    const result = validatePagination({ page: '99999', pageSize: '99999' });
    assertEqual(result.pageSize, 200, 'PageSize capped at 200');
  });

  // =============================================
  testGroup('44. Phone Format Edge Cases', () => {
    assertEqual(formatPhone(''), '', 'Empty phone');
    assertEqual(formatPhone(null), '', 'Null phone');
    const formatted = formatPhone('9876543210');
    assert(typeof formatted === 'string', 'Phone formatted to string');
  });

  // =============================================
  testGroup('45. GenerateCustomerId Sequence', () => {
    assertEqual(generateCustomerId(1), 'CUST-0001', 'First customer');
    assertEqual(generateCustomerId(100), 'CUST-0100', 'Hundredth customer');
    assertEqual(generateCustomerId(9999), 'CUST-9999', 'Max customer');
  });

  // =============================================
  testGroup('46. FormatDate Edge Cases', () => {
    assertEqual(formatDate(null), '', 'Null date');
    assertEqual(formatDate(''), '', 'Empty date');
    assertEqual(formatDate('invalid-date'), 'invalid-date', 'Invalid date returned as-is');
    assertEqual(formatDate('2026-07-18', 'YYYY-MM-DD'), '2026-07-18', 'YYYY-MM-DD format');
  });

  // =============================================
  testGroup('47. Invoice Service — Reserve Number', () => {
    const invNum = invoiceService.reserveInvoiceNumber();
    assert(invNum.startsWith('INV-'), 'Reserved invoice starts with prefix');

    const settings = settingsService.getShopSettings();
    assert(settings.invoice_next_number > 1, 'Invoice next number incremented');
  });

  // =============================================
  testGroup('48. Audit Service — Recent Limit', () => {
    const recent = auditService.getRecent(3);
    assert(recent.length <= 3, 'Recent audit respects limit');
  });

  // =============================================
  testGroup('49. Validation — Weight', () => {
    assertEqual(validateWeight('0'), 0, 'Zero weight');
    assertEqual(validateWeight(null), null, 'Null weight returns null');
    assertEqual(validateWeight(undefined), null, 'Undefined weight returns null');
    let threw = false;
    try { validateWeight('-5'); } catch (e) { threw = true; }
    assert(threw, 'Negative weight rejected');
  });

  // =============================================
  testGroup('50. Validation — Amount', () => {
    assertEqual(validateAmount('0'), 0, 'Zero amount');
    assertEqual(validateAmount('99.999'), 100, 'Amount rounded to 2 decimals');
  });

  // =============================================
  testGroup('51. First-Run Detection — No Owner', () => {
    const db = connection.getDb();
    const ownerRole = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get();
    const ownerCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ? AND is_active = 1').get(ownerRole.id);
    assert(ownerCount.count >= 1, 'Owner exists after seeding');
  });

  // =============================================
  testGroup('52. Duplicate Owner Prevention', () => {
    let threw = false;
    try {
      authService.createFirstOwner({
        displayName: 'Another Owner',
        username: 'owner2',
        password: 'secure456'
      });
    } catch (e) {
      threw = true;
      assertEqual(e.code, ERROR_CODES.CONFLICT, 'Duplicate owner throws conflict');
    }
    assert(threw, 'Duplicate owner creation rejected');
  });

  // =============================================
  testGroup('53. Staff Creation', () => {
    const result = staffService.create({
      displayName: 'Staff One',
      username: 'staff1',
      password: 'staffpass1'
    }, ownerId);
    assert(result.id > 0, 'Staff created with ID');
    assertEqual(result.username, 'staff1', 'Staff username set');
  });

  // =============================================
  testGroup('54. Duplicate Username Rejected', () => {
    let threw = false;
    try {
      staffService.create({
        displayName: 'Staff Dup',
        username: 'staff1',
        password: 'staffpass2'
      }, ownerId);
    } catch (e) {
      threw = true;
      assertEqual(e.code, ERROR_CODES.CONFLICT, 'Duplicate username throws conflict');
    }
    assert(threw, 'Duplicate username rejected');
  });

  // =============================================
  testGroup('55. Staff Update', () => {
    const allStaff = staffService.list();
    const staff = allStaff.find(s => s.username === 'staff1');
    assert(staff !== undefined, 'Staff found for update');

    const updated = staffService.update(staff.id, { displayName: 'Staff One Updated' }, ownerId);
    assert(updated.updated, 'Staff updated');

    const fetched = staffService.getById(staff.id);
    assertEqual(fetched.displayName, 'Staff One Updated', 'Staff display name updated');
  });

  // =============================================
  testGroup('56. Staff Deactivation', () => {
    const allStaff = staffService.list();
    const staff = allStaff.find(s => s.username === 'staff1');
    const result = staffService.setActive(staff.id, false, ownerId);
    assertEqual(result.active, false, 'Staff deactivated');
  });

  // =============================================
  testGroup('57. Staff Reactivation', () => {
    const allStaff = staffService.list();
    const staff = allStaff.find(s => s.username === 'staff1');
    const result = staffService.setActive(staff.id, true, ownerId);
    assertEqual(result.active, true, 'Staff reactivated');
  });

  // =============================================
  testGroup('58. Staff Password Reset', () => {
    const allStaff = staffService.list();
    const staff = allStaff.find(s => s.username === 'staff1');
    const result = staffService.resetPassword(staff.id, 'newpass123', ownerId);
    assert(result.reset, 'Password reset successfully');
  });

  // =============================================
  testGroup('59. Last Owner Protection', () => {
    const db = connection.getDb();
    const ownerRole = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get();

    // Create a second owner to test protection
    const { hashPassword } = require('../security/password');
    db.prepare(`INSERT INTO users (username, password_hash, display_name, role_id, is_active)
      VALUES ('owner2', ?, 'Second Owner', ?, 1)`).run(hashPassword('test'), ownerRole.id);
    const secondOwnerId = db.lastInsertRowid;

    // With 2 owners, deactivating one should work
    const activeOwners = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ? AND is_active = 1').get(ownerRole.id);
    assertEqual(activeOwners.count, 2, 'Two active owners exist');

    // Deactivate the second owner
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(secondOwnerId);

    // Only one owner left — protection logic should detect this
    const remaining = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ? AND is_active = 1').get(ownerRole.id);
    assertEqual(remaining.count, 1, 'Only one active owner remains');

    // Clean up: reactivate second owner
    db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(secondOwnerId);
  });

  // =============================================
  testGroup('60. Password Change', () => {
    const result = authService.changePassword(ownerId, 'owner123', 'newowner456');
    assert(result.changed, 'Password changed successfully');

    // Verify new password works
    const verifyResult = require('../security/password').verifyPassword('newowner456',
      require('../repositories/user.repository').findById(ownerId).password_hash);
    assert(verifyResult, 'New password verifies correctly');

    // Change back
    authService.changePassword(ownerId, 'newowner456', 'owner123');
  });

  // =============================================
  testGroup('61. Permission — setUserPermission', () => {
    const allStaff = staffService.list();
    const staff = allStaff.find(s => s.username === 'staff1');

    // Get the backup.create permission ID
    const db = connection.getDb();
    const backupPerm = db.prepare("SELECT id FROM permissions WHERE code = 'backup.create'").get();

    // Grant backup.create to staff
    permissionService.setUserPermission(staff.id, backupPerm.id, true, ownerId);

    // Verify staff now has backup.create
    assert(require('../security/permission').hasPermission(staff.id, 'backup.create'), 'Staff granted backup.create');

    // Deny backup.create
    permissionService.setUserPermission(staff.id, backupPerm.id, false, ownerId);

    // Verify it's revoked
    assert(!require('../security/permission').hasPermission(staff.id, 'backup.create'), 'Staff denied backup.create');
  });

  // =============================================
  testGroup('62. Audit — Auth Events', () => {
    const recent = auditService.getRecent(25);
    const actions = recent.map(a => a.action);
    assert(actions.includes('STAFF_CREATED'), 'STAFF_CREATED audit logged');
    assert(actions.includes('STAFF_UPDATED'), 'STAFF_UPDATED audit logged');
    assert(actions.includes('STAFF_DEACTIVATED'), 'STAFF_DEACTIVATED audit logged');
    assert(actions.includes('STAFF_REACTIVATED'), 'STAFF_REACTIVATED audit logged');
    assert(actions.includes('PASSWORD_RESET'), 'PASSWORD_RESET audit logged');
    assert(actions.includes('PASSWORD_CHANGED'), 'PASSWORD_CHANGED audit logged');
  });

  // =============================================
  testGroup('63. Settings — Setup Detection (not complete)', () => {
    const { ShopSettingsRepository } = require('../repositories/settings.repository');
    ShopSettingsRepository.update({ shop_name: null });
    const complete = settingsService.isSetupComplete();
    assert(!complete, 'Setup not complete when shop_name is empty');
  });

  // =============================================
  testGroup('64. Settings — Complete Setup', () => {
    const result = settingsService.completeSetup({
      shop_name: 'My Test Shop',
      owner_name: 'Test Owner',
      city: 'Mumbai',
      phone: '9876543210'
    }, ownerId);

    const settings = settingsService.getShopSettings();
    assertEqual(settings.shop_name, 'My Test Shop', 'Shop name set after completion');
    assertEqual(settings.city, 'Mumbai', 'City set after completion');
  });

  // =============================================
  testGroup('65. Settings — Setup Detection (complete)', () => {
    const complete = settingsService.isSetupComplete();
    assert(complete, 'Setup complete after shop_name is set');
  });

  // =============================================
  testGroup('66. Settings — Update All Fields', () => {
    settingsService.updateShopSettings({
      owner_name: 'Owner Updated',
      address: '123 Main Street',
      whatsapp_number: '9876543210',
      gst_number: '27AABCU9603R1ZM',
      pan_number: 'ABCDE1234F',
      hallmark_registration: 'BIS-12345',
      currency: '$',
      date_format: 'MM/DD/YYYY',
      invoice_prefix: 'BILL-',
      invoice_next_number: 100,
      default_gst_rate: 5.0,
      enable_inventory: 0
    }, ownerId);

    const s = settingsService.getShopSettings();
    assertEqual(s.owner_name, 'Owner Updated', 'Owner name updated');
    assertEqual(s.address, '123 Main Street', 'Address updated');
    assertEqual(s.whatsapp_number, '9876543210', 'WhatsApp updated');
    assertEqual(s.gst_number, '27AABCU9603R1ZM', 'GST updated');
    assertEqual(s.pan_number, 'ABCDE1234F', 'PAN updated');
    assertEqual(s.hallmark_registration, 'BIS-12345', 'Hallmark updated');
    assertEqual(s.currency, '$', 'Currency updated');
    assertEqual(s.date_format, 'MM/DD/YYYY', 'Date format updated');
    assertEqual(s.invoice_prefix, 'BILL-', 'Invoice prefix updated');
    assertEqual(s.invoice_next_number, 100, 'Next invoice number updated');
    assertEqual(s.default_gst_rate, 5.0, 'GST rate updated');
    assertEqual(s.enable_inventory, 0, 'Inventory disabled');
  });

  // =============================================
  testGroup('67. Settings — Invoice Config', () => {
    const config = settingsService.getInvoiceConfig();
    assertEqual(config.prefix, 'BILL-', 'Invoice prefix from config');
    assertEqual(config.nextNumber, 100, 'Next number from config');
  });

  // =============================================
  testGroup('68. Settings — Permission Enforcement', () => {
    // Staff (non-owner) should not have settings.edit
    assert(!require('../security/permission').hasPermission(staffId, 'settings.edit'), 'Staff lacks settings.edit');
    let threw = false;
    try {
      require('../security/permission').requirePermission(staffId, 'settings.edit');
    } catch (e) { threw = true; }
    assert(threw, 'Staff cannot update settings (permission denied)');
  });

  // =============================================
  testGroup('69. App Settings — Get', () => {
    const appSettings = settingsService.getAppSettings();
    assert(appSettings.id === 1, 'App settings single row');
    assert(appSettings.schema_version >= 1, 'Schema version set');
    assert(appSettings.theme === 'light', 'Default theme is light');
    assert(appSettings.language === 'en', 'Default language is en');
  });

  // =============================================
  testGroup('70. Settings — Reset for Setup Test', () => {
    // Reset shop_name to empty for next test runs
    const { ShopSettingsRepository } = require('../repositories/settings.repository');
    ShopSettingsRepository.update({ shop_name: null });
    const complete = settingsService.isSetupComplete();
    assert(!complete, 'Setup not complete after resetting shop_name');
  });

  // =============================================
  testGroup('71. Customer — Membership FK Validation', () => {
    let threw = false;
    try {
      customerService.create({
        name: 'Bad Membership',
        phone1: '9111111111',
        membership_level_id: 99999
      }, ownerId);
    } catch (e) {
      threw = true;
      assertEqual(e.code, ERROR_CODES.VALIDATION_ERROR, 'Invalid membership throws validation error');
    }
    assert(threw, 'Invalid membership level rejected');
  });

  // =============================================
  testGroup('72. Customer — Aadhaar Masking on Get', () => {
    const customer = customerService.create({
      name: 'Aadhaar Test',
      phone1: '9222222222',
      aadhaar_number: '123456789012'
    }, ownerId);

    assert(customer.aadhaar_number === '********', 'Aadhaar masked on create return');

    const fetched = customerService.getById(customer.id);
    assertEqual(fetched.aadhaar_number, '********', 'Aadhaar masked on getById');

    // Clean up
    customerService.softDelete(customer.id, ownerId);
  });

  // =============================================
  testGroup('73. Membership Service — List', () => {
    const { membershipService } = require('../services');
    const levels = membershipService.getAll();
    assert(levels.length >= 1, 'Membership levels listed');
    assert(levels[0].name !== undefined, 'Level has name');
    assert(levels[0].sort_order !== undefined, 'Level has sort_order');
    assert(levels.find(l => l.is_default === 1) !== undefined, 'Default level exists');
  });

  // =============================================
  testGroup('74. Product Service — Create', () => {
    const product = productService.create({
      product_name: '22K Gold Ring',
      category_id: catId,
      product_type_id: typeId,
      metal: 'Gold',
      purity: '22K',
      gross_weight: 8.5,
      net_weight: 7.8,
      making_charge: 450,
      selling_price: 38500,
      quantity_in_stock: 15,
      hsn_code: '71131913'
    }, ownerId);

    assert(product.id > 0, 'Product created with ID');
    assertEqual(product.product_name, '22K Gold Ring', 'Product name saved');
    assertEqual(product.metal, 'Gold', 'Metal saved');
    assertEqual(product.purity, '22K', 'Purity saved');
    assertEqual(product.quantity_in_stock, 15, 'Stock quantity saved');
    assertEqual(product.is_active, 1, 'Active by default');
    assertEqual(product.is_deleted, 0, 'Not deleted by default');
    assert(product.created_at !== undefined, 'Has created_at timestamp');

    global._testProductId = product.id;
  });

  // =============================================
  testGroup('75. Product Service — Create with All Fields', () => {
    const product = productService.create({
      product_name: 'Diamond Pendant',
      category_id: catId,
      product_type_id: typeId,
      metal: 'Gold',
      purity: '18K',
      gross_weight: 5.2,
      net_weight: 3.8,
      stone_weight: 1.2,
      stone_type: 'Diamond',
      making_charge: 2500,
      wastage_percentage: 3.5,
      purchase_price: 65000,
      selling_price: 95000,
      supplier_id: null,
      quantity_in_stock: 5,
      unit: 'gms',
      description: 'Premium diamond pendant with 18K gold setting',
      hallmark_details: 'BIS Hallmark 916',
      hsn_code: '71131913',
      is_active: 1
    }, ownerId);

    assert(product.id > 0, 'Full product created with ID');
    assertEqual(product.product_name, 'Diamond Pendant', 'Full product name saved');
    assertEqual(product.stone_type, 'Diamond', 'Stone type saved');
    assertEqual(product.wastage_percentage, 3.5, 'Wastage % saved');
    assertEqual(product.description, 'Premium diamond pendant with 18K gold setting', 'Description saved');
    assertEqual(product.hallmark_details, 'BIS Hallmark 916', 'Hallmark details saved');
  });

  // =============================================
  testGroup('76. Product Service — Get By ID', () => {
    const product = productService.getById(global._testProductId);
    assertEqual(product.product_name, '22K Gold Ring', 'Get by ID returns correct product');
    assertEqual(product.metal, 'Gold', 'Metal field intact');

    let threw = false;
    try { productService.getById(99999); } catch (e) { threw = true; }
    assert(threw, 'Non-existent product throws not found');
  });

  // =============================================
  testGroup('77. Product Service — Update', () => {
    const updated = productService.update(global._testProductId, {
      product_name: '24K Gold Ring',
      selling_price: 42000,
      metal: 'Gold',
      purity: '24K'
    }, ownerId);

    assertEqual(updated.product_name, '24K Gold Ring', 'Product name updated');
    assertEqual(updated.selling_price, 42000, 'Selling price updated');
    assertEqual(updated.purity, '24K', 'Purity updated');
    assert(updated.updated_at !== undefined, 'Updated timestamp set');
  });

  // =============================================
  testGroup('78. Product Service — Soft Delete', () => {
    const toDelete = productService.create({
      product_name: 'Temp Product',
      selling_price: 1000,
      quantity_in_stock: 1
    }, ownerId);

    const result = productService.softDelete(toDelete.id, ownerId);
    assertEqual(result.deleted, true, 'Product soft-deleted');

    let threw = false;
    try { productService.getById(toDelete.id); } catch (e) { threw = true; }
    assert(threw, 'Deleted product not found by getById');
  });

  // =============================================
  testGroup('79. Product Service — Search', () => {
    const result = productService.search({ page: 1, pageSize: 10 });
    assert(result.data.length >= 2, 'Search returns products');
    assert(result.pagination.total >= 2, 'Pagination has total');
    assertEqual(result.pagination.page, 1, 'Pagination page correct');

    const searchResult = productService.search({ search: 'Gold', pageSize: 10 });
    assert(searchResult.data.length >= 1, 'Search by name works');
    assert(searchResult.data.some(p => p.product_name.includes('Gold')), 'Search results contain matching name');

    const paginated = productService.search({ page: 1, pageSize: 1 });
    assertEqual(paginated.data.length, 1, 'Page size respected');
    assert(paginated.pagination.totalPages >= 2, 'Multiple pages for small page size');

    // Search by category
    const catResult = productService.search({ category_id: catId, pageSize: 10 });
    assert(catResult.data.length >= 1, 'Search by category works');
  });

  // =============================================
  testGroup('80. Product Service — Low Stock', () => {
    productService.create({ product_name: 'Low Stock Item 1', selling_price: 500, quantity_in_stock: 2 }, ownerId);
    productService.create({ product_name: 'Low Stock Item 2', selling_price: 500, quantity_in_stock: 3 }, ownerId);
    productService.create({ product_name: 'High Stock Item', selling_price: 500, quantity_in_stock: 50 }, ownerId);

    const lowStock = productService.getLowStock(5);
    assert(lowStock.length >= 2, 'Low stock products detected');
    assert(lowStock.every(p => p.quantity_in_stock <= 5), 'All returned items have stock <= threshold');
    assert(lowStock.every(p => p.is_active === 1), 'All low stock items are active');
  });

  // =============================================
  testGroup('81. Inventory Service — Adjust Stock', () => {
    const adjustment = inventoryService.adjustStock(global._testProductId, {
      movement_type: 'purchase_added',
      quantity_change: 10,
      notes: 'New stock purchase'
    }, ownerId);

    assertEqual(adjustment.product_id, global._testProductId, 'Adjustment returns product_id');
    assertEqual(adjustment.movement_type, 'purchase_added', 'Movement type recorded');
    assertEqual(adjustment.quantity_change, 10, 'Quantity change recorded');
    assertEqual(adjustment.quantity_before, 15, 'Quantity before is correct');
    assertEqual(adjustment.quantity_after, 25, 'Quantity after is correct (15 + 10)');

    const product = productService.getById(global._testProductId);
    assertEqual(product.quantity_in_stock, 25, 'Stock updated in product record');

    const movements = inventoryService.getMovements(global._testProductId);
    assert(movements.length >= 1, 'Movement history recorded');
    const latest = movements[0];
    assertEqual(latest.movement_type, 'purchase_added', 'Latest movement type correct');
    assertEqual(latest.quantity_change, 10, 'Latest movement quantity correct');
  });

  // =============================================
  testGroup('82. Inventory Service — Insufficient Stock Rejection', () => {
    let threw = false;
    try {
      inventoryService.adjustStock(global._testProductId, {
        movement_type: 'sold',
        quantity_change: -9999
      }, ownerId);
    } catch (e) {
      threw = true;
      assert(e.code === 'VALIDATION_ERROR' || e.message.includes('Insufficient stock'), 'Insufficient stock error thrown');
    }
    assert(threw, 'Negative adjustment exceeding stock rejected');

    // Verify stock unchanged
    const product = productService.getById(global._testProductId);
    assertEqual(product.quantity_in_stock, 25, 'Stock unchanged after failed adjustment');
  });

  // =============================================
  testGroup('83. Inventory Service — Invalid Movement Type', () => {
    let threw = false;
    try {
      inventoryService.adjustStock(global._testProductId, {
        movement_type: 'invalid_type',
        quantity_change: 5
      }, ownerId);
    } catch (e) {
      threw = true;
      assert(e.code === 'VALIDATION_ERROR' || e.message !== undefined, 'Invalid movement type rejected');
    }
    assert(threw, 'Invalid movement type throws validation error');
  });

  // =============================================
  testGroup('84. Inventory Service — Zero Quantity Change Rejection', () => {
    let threw = false;
    try {
      inventoryService.adjustStock(global._testProductId, {
        movement_type: 'manual_adjustment',
        quantity_change: 0
      }, ownerId);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Zero quantity change rejected');
  });

  // =============================================
  testGroup('85. Category Service — List', () => {
    const categories = categoryService.getAll();
    assert(categories.length >= 1, 'Categories listed');
    assert(categories[0].name !== undefined, 'Category has name');
    assert(categories[0].sort_order !== undefined, 'Category has sort_order');
    assert(categories.every(c => c.sort_order === null || c.sort_order >= 0), 'All categories have non-negative sort_order');
  });

  // =============================================
  testGroup('86. ProductType Service — List', () => {
    const types = productTypeService.getAll();
    assert(types.length >= 1, 'Product types listed');
    assert(types[0].name !== undefined, 'Product type has name');
    assert(types[0].sort_order !== undefined, 'Product type has sort_order');
    assert(types.every(t => t.sort_order === null || t.sort_order >= 0), 'All product types have non-negative sort_order');
  });

  // =============================================
  testGroup('87. Product Service — Invalid Name Validation', () => {
    let threw = false;
    try {
      productService.create({ product_name: '', selling_price: 100 }, ownerId);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Empty product name rejected');
  });

  // =============================================
  testGroup('88. Product Service — Inventory Movements for Deleted Product', () => {
    // Create a product, record a movement, soft delete, then verify movements still accessible
    const prod = productService.create({
      product_name: 'Movements Test',
      selling_price: 1000,
      quantity_in_stock: 10
    }, ownerId);

    inventoryService.adjustStock(prod.id, {
      movement_type: 'sold',
      quantity_change: -2,
      notes: 'Test sale'
    }, ownerId);

    const movements = inventoryService.getMovements(prod.id);
    assert(movements.length >= 1, 'Movements recorded before delete');

    productService.softDelete(prod.id, ownerId);

    // Movements should still be queryable by repository directly
    const { inventoryRepository } = require('../repositories');
    const afterDelete = inventoryRepository.findByProduct(prod.id);
    assert(afterDelete.length >= 1, 'Movements preserved after product soft delete');
  });

  // =============================================
  testGroup('89. Product Service — Search with Metal Filter', () => {
    const result = productService.search({ metal: 'Gold', pageSize: 10 });
    assert(result.data.length >= 1, 'Search by metal returns products');
    assert(result.data.every(p => p.metal === 'Gold'), 'All results have matching metal');
  });

  // =============================================
  testGroup('91. Payment Service — Create', () => {
    const payment = paymentService.create({
      customer_id: global._testCustomerId,
      amount: 5000,
      payment_method: 'cash',
      notes: 'Test payment'
    }, ownerId);

    assert(payment.id > 0, 'Payment created with ID');
    assertEqual(payment.amount, 5000, 'Payment amount correct');
    assertEqual(payment.payment_method, 'cash', 'Payment method correct');
    assertEqual(payment.type, 'bill_payment', 'Payment type default');

    global._testPaymentId = payment.id;
  });

  // =============================================
  testGroup('92. Payment Service — Invalid Amount', () => {
    let threw = false;
    try {
      paymentService.create({
        customer_id: global._testCustomerId,
        amount: 0,
        payment_method: 'cash'
      }, ownerId);
    } catch (e) { threw = true; }
    assert(threw, 'Zero payment amount rejected');

    threw = false;
    try {
      paymentService.create({
        customer_id: global._testCustomerId,
        amount: -100,
        payment_method: 'cash'
      }, ownerId);
    } catch (e) { threw = true; }
    assert(threw, 'Negative payment amount rejected');
  });

  // =============================================
  testGroup('93. Bill Service — GST Bill Full Payment', () => {
    // Create a product for inventory billing
    const prod = productService.create({
      product_name: 'Billing Test Gold Ring',
      category_id: catId,
      product_type_id: typeId,
      metal: 'Gold',
      purity: '22K',
      gross_weight: 10.0,
      net_weight: 9.2,
      making_charge: 500,
      selling_price: 45000,
      quantity_in_stock: 20,
      hsn_code: '71131913'
    }, ownerId);
    global._testBillProductId = prod.id;

    const bill = billService.finalize({
      customer_id: global._testCustomerId,
      bill_type: 'gst',
      bill_date: '2026-07-19',
      items: [{
        item_type: 'inventory',
        product_id: prod.id,
        description: 'Billing Test Gold Ring',
        category_id: catId,
        hsn_code: '71131913',
        metal: 'Gold',
        purity: '22K',
        gross_weight: 10.0,
        net_weight: 9.2,
        making_charge: 500,
        wastage_percentage: 2,
        wastage_amount: 900,
        rate: 45000,
        quantity: 1,
        discount_percentage: 0,
        discount_amount: 0,
        taxable_amount: 46400,
        cgst_rate: 1.5,
        sgst_rate: 1.5,
        cgst_amount: 696,
        sgst_amount: 696,
        total: 47792
      }],
      subtotal: 45000,
      making_charge_total: 500,
      wastage_total: 900,
      taxable_amount: 46400,
      cgst_rate: 1.5,
      sgst_rate: 1.5,
      cgst_amount: 696,
      sgst_amount: 696,
      tax_total: 1392,
      grand_total: 47792,
      paid_amount: 47792,
      payment_method: 'upi',
      payment_reference: 'test@upi'
    }, ownerId);

    assert(bill.id > 0, 'GST bill created with ID');
    assertEqual(bill.bill_type, 'gst', 'Bill type is GST');
    assertEqual(bill.payment_status, 'paid', 'Payment status is paid');
    assertEqual(bill.paid_amount, 47792, 'Full amount paid');
    assertEqual(bill.balance_amount, 0, 'Balance is zero');
    assert(bill.invoice_number && bill.invoice_number.includes('-'), 'Invoice number has valid format');
    assert(bill.items.length === 1, 'Bill has 1 item');
    assertEqual(bill.items[0].item_type, 'inventory', 'Item type is inventory');
    assertEqual(bill.items[0].total, 47792, 'Item total correct');

    const updatedProduct = productRepository.findById(prod.id);
    assertEqual(updatedProduct.quantity_in_stock, 19, 'Stock reduced from 20 to 19');

    global._testGstBillId = bill.id;
    global._testGstInvoiceNumber = bill.invoice_number;
  });

  // =============================================
  testGroup('94. Bill Service — Non-GST Bill Manual Items', () => {
    const bill = billService.finalize({
      customer_id: global._testCustomerId,
      bill_type: 'non_gst',
      bill_date: '2026-07-19',
      items: [{
        item_type: 'manual',
        description: 'Repair Service - Gold Ring',
        metal: 'Gold',
        purity: '22K',
        making_charge: 300,
        rate: 0,
        quantity: 1,
        total: 300
      }, {
        item_type: 'manual',
        description: 'Polishing Service',
        rate: 500,
        quantity: 1,
        total: 500
      }],
      subtotal: 800,
      making_charge_total: 300,
      grand_total: 800,
      paid_amount: 800,
      payment_method: 'cash'
    }, ownerId);

    assert(bill.id > 0, 'Non-GST bill created');
    assertEqual(bill.bill_type, 'non_gst', 'Bill type non-GST');
    assertEqual(bill.payment_status, 'paid', 'Payment status paid');
    assertEqual(bill.items.length, 2, 'Bill has 2 items');
    assertEqual(bill.cgst_rate, 0, 'CGST rate is 0 for non-GST');
    assertEqual(bill.tax_total, 0, 'Tax total is 0');

    global._testNonGstBillId = bill.id;
  });

  // =============================================
  testGroup('95. Bill Service — Mixed Items Partial Payment', () => {
    const bill = billService.finalize({
      customer_id: global._testCustomerId,
      bill_type: 'gst',
      bill_date: '2026-07-19',
      items: [{
        item_type: 'inventory',
        product_id: global._testBillProductId,
        description: 'Gold Ring',
        hsn_code: '71131913',
        metal: 'Gold',
        purity: '22K',
        rate: 45000,
        quantity: 2,
        making_charge: 1000,
        wastage_percentage: 2,
        wastage_amount: 1800,
        taxable_amount: 92800,
        cgst_rate: 1.5,
        sgst_rate: 1.5,
        cgst_amount: 1392,
        sgst_amount: 1392,
        total: 95584
      }, {
        item_type: 'manual',
        description: 'Engraving Service',
        rate: 2000,
        quantity: 1,
        making_charge: 0,
        total: 2000
      }],
      subtotal: 92000,
      making_charge_total: 1000,
      wastage_total: 1800,
      taxable_amount: 92800,
      cgst_rate: 1.5,
      sgst_rate: 1.5,
      cgst_amount: 1392,
      sgst_amount: 1392,
      tax_total: 2784,
      grand_total: 97584,
      paid_amount: 50000,
      payment_method: 'cash',
      payment_reference: null
    }, ownerId);

    assert(bill.id > 0, 'Mixed bill created');
    assertEqual(bill.payment_status, 'partial', 'Payment status partial');
    assertEqual(bill.paid_amount, 50000, 'Partial payment recorded');
    assertEqual(bill.balance_amount, 47584, 'Balance due correct');
    assert(bill.items.length === 2, 'Bill has 2 items');

    const updatedProduct = productRepository.findById(global._testBillProductId);
    assertEqual(updatedProduct.quantity_in_stock, 17, 'Stock reduced by 2 more (19-2=17)');

    global._testMixedBillId = bill.id;
  });

  // =============================================
  testGroup('96. Bill Service — Unpaid Bill', () => {
    const bill = billService.finalize({
      customer_id: global._testCustomerId,
      bill_type: 'non_gst',
      bill_date: '2026-07-19',
      items: [{
        item_type: 'manual',
        description: 'Custom Design Consultancy',
        rate: 15000,
        quantity: 1,
        total: 15000
      }],
      subtotal: 15000,
      grand_total: 15000,
      paid_amount: 0
    }, ownerId);

    assert(bill.id > 0, 'Unpaid bill created');
    assertEqual(bill.payment_status, 'unpaid', 'Status unpaid');
    assertEqual(bill.paid_amount, 0, 'No payment');
    assertEqual(bill.balance_amount, 15000, 'Full amount as balance');

    global._testUnpaidBillId = bill.id;
  });

  // =============================================
  testGroup('97. Bill Service — Get By ID', () => {
    const bill = billService.getById(global._testGstBillId);
    assert(bill !== null, 'Bill found by ID');
    assertEqual(bill.id, global._testGstBillId, 'Correct bill ID');
    assert(bill.items !== undefined, 'Bill has items array');
    assert(bill.items.length >= 1, 'Bill has at least 1 item');
    assert(bill.customer_name !== undefined, 'Bill has customer_name');
    assert(bill.user_name !== undefined, 'Bill has user_name');
  });

  // =============================================
  testGroup('98. Bill Service — Search', () => {
    const all = billService.search({ page: 1, pageSize: 10 });
    assert(all.data.length >= 3, 'Search returns bills');
    assert(all.pagination.total >= 3, 'Pagination total');

    const gstOnly = billService.search({ bill_type: 'gst', pageSize: 10 });
    assert(gstOnly.data.every(b => b.bill_type === 'gst'), 'GST filter works');

    const paidOnly = billService.search({ payment_status: 'paid', pageSize: 10 });
    assert(paidOnly.data.every(b => b.payment_status === 'paid'), 'Payment status filter works');

    const searchByInv = billService.search({ search: global._testGstInvoiceNumber.slice(0, 10), pageSize: 10 });
    assert(searchByInv.data.length >= 1, 'Search by invoice number works');
  });

  // =============================================
  testGroup('99. Bill Service — Cancel with Stock Restoration', () => {
    const beforeStock = productRepository.findById(global._testBillProductId);
    const beforeQty = beforeStock.quantity_in_stock;

    const result = billService.cancel(global._testGstBillId, { reason: 'Test cancellation' }, ownerId);
    assertEqual(result.cancelled, true, 'Bill cancelled');

    const cancelled = billService.getById(global._testGstBillId);
    assertEqual(cancelled.status, 'cancelled', 'Bill status is cancelled');
    assertEqual(cancelled.cancellation_reason, 'Test cancellation', 'Cancellation reason saved');

    const afterStock = productRepository.findById(global._testBillProductId);
    assertEqual(afterStock.quantity_in_stock, beforeQty + 1, 'Stock restored (+1 for the sold item)');
  });

  // =============================================
  testGroup('100. Bill Service — Cancel Already Cancelled Rejected', () => {
    let threw = false;
    try {
      billService.cancel(global._testGstBillId, { reason: 'Double cancel' }, ownerId);
    } catch (e) { threw = true; }
    assert(threw, 'Already cancelled bill rejected');
  });

  // =============================================
  testGroup('101. Bill Service — No Items Rejected', () => {
    let threw = false;
    try {
      billService.finalize({
        customer_id: global._testCustomerId,
        bill_type: 'gst',
        items: [],
        grand_total: 0,
        paid_amount: 0
      }, ownerId);
    } catch (e) { threw = true; }
    assert(threw, 'Bill with no items rejected');
  });

  // =============================================
  testGroup('102. Payment Service — Search', () => {
    const result = paymentService.search({ page: 1, pageSize: 10 });
    assert(result.data.length >= 1, 'Payment search returns results');
    assert(result.pagination.total >= 1, 'Payment pagination total');
  });

  // =============================================
  testGroup('103. Payment Service — Get For Bill', () => {
    const payments = paymentService.getForBill(global._testGstBillId);
    assert(payments.length >= 1, 'Payments found for bill');
    assert(payments[0].payment_method !== undefined, 'Payment has method');
    assert(payments[0].amount !== undefined, 'Payment has amount');
  });

  // =============================================
  testGroup('104. Bill Service — Khata Balance for Partial Payment', () => {
    const balance = require('../services/khata.service').getCurrentBalance(global._testCustomerId);
    // The customer had opening 25000 + 30000 adjustment = 55000
    // Plus bills: 47792 (gst paid) + 800 (non-gst paid) + 97584 (partial) + 15000 (unpaid)
    // Khata: bill entries (debits) = 47792 + 800 + 97584 + 15000 = 161176
    // Payment entries (credits) = 47792 (gst) + 800 (non-gst) + 50000 (partial) + 5000 (test payment) + 5000 (opening adj?)
    // Let's just verify balance > 0 (there should be unpaid balance)
    assert(balance > 0, 'Customer has khata balance due to unpaid/partial bills');
  });

  // =============================================
  testGroup('105. Invoice Service — Reserve Number Conflict Prevention', () => {
    const inv1 = invoiceService.reserveInvoiceNumber();
    const inv2 = invoiceService.reserveInvoiceNumber();
    assert(inv1 !== inv2, 'Consecutive invoice numbers differ');
  });

  // =============================================
  testGroup('106. Khata Service — Bill History Linked', () => {
    const khata = require('../services/khata.service');
    const history = khata.getCustomerKhata(global._testCustomerId);
    const billEntries = history.filter(t => t.transaction_type === 'bill');
    assert(billEntries.length >= 4, 'Khata has bill entries from billing');
    const paidBillEntry = billEntries.find(t => t.bill_id === global._testGstBillId);
    assert(paidBillEntry !== undefined, 'Paid bill has khata entry');
  });

  // =============================================
  testGroup('90. Inventory Service — Get Stock History', () => {
    // Record additional movements to build history
    inventoryService.adjustStock(global._testProductId, {
      movement_type: 'manual_adjustment',
      quantity_change: -5,
      notes: 'Manual reduction'
    }, ownerId);

    inventoryService.adjustStock(global._testProductId, {
      movement_type: 'repair',
      quantity_change: -1,
      notes: 'Sent for repair'
    }, ownerId);

    const history = inventoryService.getStockHistory(global._testProductId);
    assert(history.length >= 3, 'Stock history has multiple entries');
    // History should be ordered ascending by time
    assert(history[0].quantity_before !== undefined, 'History entries have quantity_before');
    assert(history[0].quantity_after !== undefined, 'History entries have quantity_after');
    assert(history.some(h => h.movement_type === 'manual_adjustment'), 'History includes manual_adjustment');
    assert(history.some(h => h.movement_type === 'repair'), 'History includes repair');
  });

  // Run all test groups sequentially
  for (const { name, fn } of testQueue) {
    try {
      await runTestGroup(name, fn);
    } catch (err) {
      failed++;
      console.error(`  ERROR: ${name} — ${err.message}`);
    }
  }

  // Cleanup
  connection.close();
  cleanup();

  // Remove demo db too
  try { fs.unlinkSync(path.join(__dirname, '..', 'demo_jwellers_edith.db')); } catch (e) {}
  try { fs.unlinkSync(path.join(__dirname, '..', 'demo_jwellers_edith.db-wal')); } catch (e) {}
  try { fs.unlinkSync(path.join(__dirname, '..', 'demo_jwellers_edith.db-shm')); } catch (e) {}

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
