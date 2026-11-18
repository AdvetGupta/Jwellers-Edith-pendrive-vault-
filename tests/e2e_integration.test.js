/**
 * End-to-end integration test for Jwellers Edith
 * Tests: DB init, auth, permissions, customer CRUD, product, billing, dashboard
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

// Use a temp DB for testing
const testDbPath = path.join(os.tmpdir(), `jwe_test_${Date.now()}.db`);

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    console.log(`  ✅ PASS: ${msg} (= ${JSON.stringify(actual)})`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  Jwellers Edith — Integration Test');
  console.log('========================================\n');
  console.log(`Using test DB: ${testDbPath}\n`);

  // ── 1. DATABASE INITIALIZATION ──────────────────────────────────────────────
  console.log('▶ [1] Database Initialization');
  const { initialize } = require('../database/init');
  let db;
  try {
    db = await initialize(testDbPath);
    assert(db !== null, 'Database initialized without error');
    assert(fs.existsSync(testDbPath), 'Database file saved to disk after init');

    // Verify core tables were created
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);
    console.log(`  Tables found: ${tables.join(', ')}`);
    assert(tables.includes('roles'), 'roles table exists');
    assert(tables.includes('users'), 'users table exists');
    assert(tables.includes('customers'), 'customers table exists');
    assert(tables.includes('bills'), 'bills table exists');
    assert(tables.includes('products'), 'products table exists');
    assert(tables.includes('permissions'), 'permissions table exists');
    assert(tables.includes('activity_logs'), 'activity_logs table exists');

    // Verify default roles
    const roles = db.prepare('SELECT name FROM roles ORDER BY id').all();
    assertEqual(roles.length, 2, 'Two default roles created (owner, staff)');
    assertEqual(roles[0].name, 'owner', 'First role is owner');
    assertEqual(roles[1].name, 'staff', 'Second role is staff');

    // Verify app_settings and shop_settings
    const appSettings = db.prepare('SELECT id FROM app_settings WHERE id = 1').get();
    assert(appSettings !== undefined, 'app_settings row exists');
    const shopSettings = db.prepare('SELECT id FROM shop_settings WHERE id = 1').get();
    assert(shopSettings !== undefined, 'shop_settings row exists');
  } catch (err) {
    console.error(`  ❌ FATAL: Database init failed — ${err.message}\n`, err.stack);
    failed++;
    process.exit(1);
  }
  console.log();

  // ── 2. AUTHENTICATION FLOW ────────────────────────────────────────────────
  console.log('▶ [2] Authentication Flow');
  const { createSession, getSession, destroySession } = require('../security/session');
  const { hashPassword, verifyPassword } = require('../security/password');
  const { userRepository } = require('../repositories');
  const { getDb } = require('../database/connection');
  const authService = require('../services/auth.service');

  // Create owner user
  let ownerId;
  try {
    const ownerRole = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get();
    assert(ownerRole !== undefined, 'Owner role found in DB');
    const hash = hashPassword('testpass123');
    const createResult = userRepository.create({
      username: 'testowner',
      password_hash: hash,
      display_name: 'Test Owner',
      role_id: ownerRole.id,
      is_active: 1
    });
    ownerId = createResult.id;
    assert(ownerId > 0, `Owner user created with id=${ownerId}`);

    // Test login
    const loginResult = await authService.login('testowner', 'testpass123');
    assert(loginResult.token !== undefined && loginResult.token.length > 0, 'Login returns a token');
    assert(loginResult.user !== undefined, 'Login returns user object');
    assertEqual(loginResult.user.username, 'testowner', 'User username correct');
    assertEqual(loginResult.user.roleName, 'owner', 'User role is owner');

    // Test session
    const session = getSession(loginResult.token);
    assert(session !== null, 'Session exists after login');
    assertEqual(session.userId, ownerId, 'Session has correct userId');

    // Test getCurrentUser
    const currentUser = authService.getCurrentUser(loginResult.token);
    assert(currentUser !== null, 'getCurrentUser returns user');
    assertEqual(currentUser.username, 'testowner', 'getCurrentUser correct username');

    // Test wrong password
    let wrongPassFailed = false;
    try {
      await authService.login('testowner', 'wrongpassword');
    } catch (e) {
      wrongPassFailed = true;
    }
    assert(wrongPassFailed, 'Login with wrong password correctly throws error');

    // Test logout
    authService.logout(loginResult.token);
    const destroyedSession = getSession(loginResult.token);
    assert(destroyedSession === null, 'Session destroyed after logout');

    // Re-login for rest of tests
    const loginResult2 = await authService.login('testowner', 'testpass123');
    assert(loginResult2.token !== undefined, 'Can login again after logout');
    global._testToken = loginResult2.token;
    global._testUserId = ownerId;
  } catch (err) {
    console.error(`  ❌ Auth flow error: ${err.message}`);
    failed++;
  }
  console.log();

  // ── 3. PERMISSIONS ────────────────────────────────────────────────────────
  console.log('▶ [3] Permission System');
  const { hasPermission, getUserPermissions } = require('../security/permission');
  try {
    // Owner has all permissions (bypasses DB check)
    assert(hasPermission(global._testUserId, 'customer.view'), 'Owner has customer.view permission');
    assert(hasPermission(global._testUserId, 'bill.create'), 'Owner has bill.create permission');
    assert(hasPermission(global._testUserId, 'dashboard.view'), 'Owner has dashboard.view permission');

    const ownerPerms = getUserPermissions(global._testUserId);
    // Owner should get all permissions from the DB (may be 0 if no permissions seeded)
    assert(Array.isArray(ownerPerms), 'getUserPermissions returns array');
    console.log(`  Owner permissions count: ${ownerPerms.length}`);
  } catch (err) {
    console.error(`  ❌ Permission error: ${err.message}`);
    failed++;
  }
  console.log();

  // ── 4. SETTINGS ──────────────────────────────────────────────────────────
  console.log('▶ [4] Settings Service');
  const settingsService = require('../services/settings.service');
  try {
    const shopSettings = settingsService.getShopSettings();
    assert(shopSettings !== null && shopSettings !== undefined, 'getShopSettings returns data');

    const isComplete = settingsService.isSetupComplete();
    assertEqual(isComplete, false, 'Setup not complete before shop_name is set');

    const updated = settingsService.updateShopSettings({ shop_name: 'Test Jewels' }, global._testUserId);
    assert(updated !== null, 'updateShopSettings returns data');
    assertEqual(updated.shop_name, 'Test Jewels', 'Shop name updated correctly');

    const isNowComplete = settingsService.isSetupComplete();
    assertEqual(isNowComplete, true, 'Setup complete after setting shop_name');

    const invoiceConfig = settingsService.getInvoiceConfig();
    assert(invoiceConfig.prefix !== undefined, 'Invoice config has prefix');
    assert(invoiceConfig.nextNumber !== undefined, 'Invoice config has nextNumber');
  } catch (err) {
    console.error(`  ❌ Settings error: ${err.message}`, err.stack);
    failed++;
  }
  console.log();

  // ── 5. CUSTOMER CRUD ─────────────────────────────────────────────────────
  console.log('▶ [5] Customer CRUD');
  const customerService = require('../services/customer.service');
  let customerId;
  try {
    const customer = customerService.create({
      name: 'Ramesh Kumar',
      phone1: '9876543210',
      city: 'Mumbai'
    }, global._testUserId);
    assert(customer !== null, 'Customer created');
    assert(customer.id > 0, `Customer id=${customer.id}`);
    assert(customer.customer_id !== undefined && customer.customer_id !== null, 'Customer has customer_id');
    customerId = customer.id;

    const found = customerService.getById(customerId);
    assert(found !== null, 'getById returns customer');
    assertEqual(found.name, 'Ramesh Kumar', 'Customer name correct');
    assertEqual(found.phone1, '9876543210', 'Customer phone correct');

    const searchResult = customerService.search({ search: 'Ramesh', page: 1, pageSize: 10 });
    assert(Array.isArray(searchResult.data), 'search returns data array');
    assert(searchResult.data.length > 0, 'Search finds the customer');
    assertEqual(searchResult.data[0].name, 'Ramesh Kumar', 'Found customer name matches');

    const updated = customerService.update(customerId, { city: 'Delhi' }, global._testUserId);
    assert(updated !== null, 'Customer update returns data');
    const foundAfterUpdate = customerService.getById(customerId);
    assertEqual(foundAfterUpdate.city, 'Delhi', 'Customer city updated');
  } catch (err) {
    console.error(`  ❌ Customer CRUD error: ${err.message}`, err.stack);
    failed++;
  }
  console.log();

  // ── 6. PRODUCT / INVENTORY ───────────────────────────────────────────────
  console.log('▶ [6] Product & Inventory');
  const productService = require('../services/product.service');
  let productId;
  try {
    const product = productService.create({
      product_name: 'Gold Ring 22K',
      metal: 'Gold',
      purity: '22K',
      gross_weight: 5.5,
      net_weight: 5.0,
      selling_price: 32000,
      quantity_in_stock: 10
    }, global._testUserId);
    assert(product !== null, 'Product created');
    assert(product.id > 0, `Product id=${product.id}`);
    productId = product.id;

    const found = productService.getById(productId);
    assert(found !== null, 'getById returns product');
    assertEqual(found.product_name, 'Gold Ring 22K', 'Product name correct');
    assert(found.quantity_in_stock >= 10, 'Product stock correct');

    const searchResult = productService.search({ search: 'Gold', page: 1, pageSize: 10 });
    assert(Array.isArray(searchResult.data), 'Product search returns data array');
    assert(searchResult.data.length > 0, 'Product search finds item');
  } catch (err) {
    console.error(`  ❌ Product error: ${err.message}`, err.stack);
    failed++;
  }
  console.log();

  // ── 7. BILLING ───────────────────────────────────────────────────────────
  console.log('▶ [7] Bill Creation');
  const billService = require('../services/bill.service');
  let billId;
  try {
    const bill = billService.finalize({
      customer_id: customerId,
      bill_type: 'gst',
      bill_date: new Date().toISOString().split('T')[0],
      items: [{
        item_type: 'inventory',
        product_id: productId,
        description: 'Gold Ring 22K',
        rate: 32000,
        quantity: 1,
        making_charge: 500,
        wastage_percentage: 2,
        discount_percentage: 0
      }],
      subtotal: 32000,
      making_charge_total: 500,
      wastage_total: 640,
      discount_amount: 0,
      discount_percentage: 0,
      stone_charge_total: 0,
      taxable_amount: 33140,
      cgst_rate: 1.5,
      sgst_rate: 1.5,
      cgst_amount: 497.1,
      sgst_amount: 497.1,
      tax_total: 994.2,
      round_off: 0,
      grand_total: 34134.2,
      paid_amount: 20000,
      payment_method: 'cash',
      notes: 'Test bill'
    }, global._testUserId);

    assert(bill !== null, 'Bill created');
    assert(bill.id > 0, `Bill id=${bill.id}`);
    assert(bill.invoice_number !== undefined && bill.invoice_number !== '', 'Bill has invoice number');
    assertEqual(bill.payment_status, 'partial', 'Payment status is partial (paid 20k of ~34k)');
    billId = bill.id;

    // Verify stock was deducted
    const productAfter = productService.getById(productId);
    assert(productAfter.quantity_in_stock < 10, 'Stock deducted after bill');

    // Get bill by id
    const foundBill = billService.getById(billId);
    assert(foundBill !== null, 'getById returns bill');
    assert(Array.isArray(foundBill.items), 'Bill has items array');
    assert(foundBill.items.length > 0, 'Bill has at least one item');
  } catch (err) {
    console.error(`  ❌ Billing error: ${err.message}`, err.stack);
    failed++;
  }
  console.log();

  // ── 8. DASHBOARD REPORT ──────────────────────────────────────────────────
  console.log('▶ [8] Dashboard Report');
  const reportService = require('../services/report.service');
  try {
    const dashboard = reportService.getDashboardData();
    assert(dashboard !== null, 'getDashboardData returns data');
    assert(dashboard.todaySales !== undefined, 'Dashboard has todaySales');
    assert(typeof dashboard.totalCustomers === 'number', 'Dashboard has totalCustomers');
    assert(typeof dashboard.lowStockCount === 'number', 'Dashboard has lowStockCount');
    assert(Array.isArray(dashboard.recentBills), 'Dashboard has recentBills array');
    assert(Array.isArray(dashboard.salesTrend), 'Dashboard has salesTrend array');

    console.log(`  Today sales: ₹${dashboard.todaySales.totalRevenue} (${dashboard.todaySales.billCount} bills)`);
    console.log(`  Total customers: ${dashboard.totalCustomers}`);
    console.log(`  Recent bills: ${dashboard.recentBills.length}`);
    assert(dashboard.totalCustomers >= 1, 'At least 1 customer visible in dashboard');
    assert(dashboard.recentBills.length >= 1, 'Created bill appears in recent bills');
  } catch (err) {
    console.error(`  ❌ Dashboard error: ${err.message}`, err.stack);
    failed++;
  }
  console.log();

  // ── 9. DATA PERSISTENCE (Save to disk) ───────────────────────────────────
  console.log('▶ [9] Data Persistence');
  try {
    // Force save
    db._saveToFile();
    assert(fs.existsSync(testDbPath), 'DB file exists on disk');
    const statBefore = fs.statSync(testDbPath).size;
    assert(statBefore > 0, `DB file has content (${statBefore} bytes)`);

    // Reload DB from disk and verify data
    const { Database } = require('../database/sqlite_shim');
    const reloadedDb = new Database(testDbPath);
    await reloadedDb.init();
    const cust = reloadedDb.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    assert(cust !== undefined, 'Customer data persists after reload from disk');
    assertEqual(cust.name, 'Ramesh Kumar', 'Customer name correct after reload');
    const billRow = reloadedDb.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
    assert(billRow !== undefined, 'Bill data persists after reload from disk');
    reloadedDb.close();
  } catch (err) {
    console.error(`  ❌ Persistence error: ${err.message}`, err.stack);
    failed++;
  }
  console.log();

  // ── CLEANUP ──────────────────────────────────────────────────────────────
  try {
    const connection = require('../database/connection');
    connection.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  } catch (e) {}

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All tests passed! Application flow is working correctly.\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\n❌ UNEXPECTED ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
