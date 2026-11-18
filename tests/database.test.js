const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const connection = require('../database/connection');
const { initialize } = require('../database/init');
const TransactionManager = require('../database/transaction_manager');
const MigrationManager = require('../database/migration_manager');
const BackupManager = require('../database/backup_manager');
const BaseRepository = require('../repositories/base_repository');

let passed = 0;
let failed = 0;
const dbPath = path.join(__dirname, 'test_jwellers.db');

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${message} (${actual})`);
  } else {
    failed++;
    console.error(`  FAIL: ${message} — expected ${expected}, got ${actual}`);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function cleanup() {
  try { connection.close(); } catch (e) {}
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(p => {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
  });
}

async function testGroup(name, fn) {
  console.log(`\n--- ${name} ---`);
  await fn();
}

async function runTests() {
  console.log('=== JWELLERS EDITH — Database Tests ===\n');

  cleanup();

  // ======================================
  await testGroup('1. Database Creation', async () => {
    try {
      const db = await initialize(dbPath);
      assert(db !== null, 'Database opened successfully');
      assert(connection.isOpen(), 'Connection reports open');

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
      const tableNames = tables.map(t => t.name);

      const expectedTables = [
        'activity_logs', 'app_settings', 'backup_history', 'bill_items', 'bills',
        'categories', 'communication_logs', 'customers', 'girvi_import_batches',
        'girvi_items', 'girvi_loans', 'girvi_payments', 'inventory_movements',
        'khata_transactions', 'membership_levels', 'migration_batches',
        'payment_allocations', 'payments', 'permissions', 'product_types',
        'products', 'role_permissions', 'roles', 'schema_migrations',
        'shop_settings', 'suppliers', 'sync_outbox', 'user_permissions', 'users'
      ];

      for (const t of expectedTables) {
        assert(tableNames.includes(t), `Table '${t}' exists`);
      }

      const filteredNames = tableNames.filter(n => n !== 'sqlite_sequence');
      assertEqual(filteredNames.length, expectedTables.length, 'All 29 tables created');

      const ownerRoleId = db.prepare("SELECT id FROM roles WHERE name = 'owner'").get().id;
      db.prepare(`INSERT INTO users (username, password_hash, display_name, role_id, is_active)
        VALUES ('testadmin', ?, 'Test Admin', ?, 1)`).run(hashPassword('test'), ownerRoleId);
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('2. Foreign Keys & Constraints', () => {
    try {
      const db = connection.getDb();

      let fkViolation = false;
      try {
        db.prepare(`INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date, grand_total, paid_amount, balance_amount)
          VALUES ('TEST-FK', 'gst', 999999, 999999, '2026-01-01', 100, 0, 100)`).run();
      } catch (e) {
        fkViolation = true;
      }
      assert(fkViolation, 'Foreign key constraint enforced (invalid customer/user)');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('3. Unique Constraints', () => {
    try {
      const db = connection.getDb();
      db.prepare(`INSERT INTO roles (name, description) VALUES ('test_unique_role', 'Test')`).run();
      let threw = false;
      try {
        db.prepare(`INSERT INTO roles (name, description) VALUES ('test_unique_role', 'Duplicate')`).run();
      } catch (e) {
        threw = true;
      }
      assert(threw, 'Duplicate role name rejected (UNIQUE constraint)');
      db.prepare(`DELETE FROM roles WHERE name = 'test_unique_role'`).run();
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('4. Customer Creation', () => {
    try {
      const db = connection.getDb();
      const result = db.prepare(`
        INSERT INTO customers (customer_id, name, phone1, city)
        VALUES ('TEST-CUST-001', 'Test Customer', '9999999999', 'Test City')
      `).run();
      assert(result.changes === 1, 'Customer created successfully');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('5. Duplicate Customer ID Prevention', () => {
    try {
      const db = connection.getDb();
      let threw = false;
      try {
        db.prepare(`
          INSERT INTO customers (customer_id, name, phone1, city)
          VALUES ('TEST-CUST-001', 'Duplicate Customer', '8888888888', 'Duplicate City')
        `).run();
      } catch (e) {
        threw = true;
      }
      assert(threw, 'Duplicate customer_id rejected by UNIQUE constraint');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('6. Bill Creation Transaction', () => {
    try {
      const db = connection.getDb();
      const customerId = db.prepare("SELECT id FROM customers WHERE customer_id = 'TEST-CUST-001'").get().id;

      let billId;
      TransactionManager.execute((txDb) => {
        const result = txDb.prepare(`
          INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date, taxable_amount, grand_total, paid_amount, balance_amount)
          VALUES ('TEST-INV-0001', 'gst', ?, 1, '2026-07-01', 10000, 10300, 10300, 0)
        `).run(customerId);
        billId = db.lastInsertRowid;

        txDb.prepare(`
          INSERT INTO bill_items (bill_id, item_type, description, quantity, total)
          VALUES (?, 'manual', 'Test Item', 1, 10300)
        `).run(billId);

        const payResult = txDb.prepare(`
          INSERT INTO payments (customer_id, user_id, payment_date, amount, payment_method, type)
          VALUES (?, 1, '2026-07-01', 10300, 'cash', 'bill_payment')
        `).run(customerId);
        const paymentId = db.lastInsertRowid;

        txDb.prepare(`
          INSERT INTO payment_allocations (payment_id, bill_id, amount)
          VALUES (?, ?, 10300)
        `).run(paymentId, billId);

        txDb.prepare(`
          INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, bill_id)
          VALUES (?, '2026-07-01', 'bill', 10300, 0, 10300, ?)
        `).run(customerId, billId);

        txDb.prepare(`
          INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance)
          VALUES (?, '2026-07-01', 'payment', 0, 10300, 0)
        `).run(customerId);
      });

      assert(billId > 0, 'Bill created inside transaction');

      const savedBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
      assertEqual(savedBill.grand_total, 10300, 'Bill grand total correct');

      const items = db.prepare('SELECT COUNT(*) as count FROM bill_items WHERE bill_id = ?').get(billId);
      assertEqual(items.count, 1, 'Bill item created');

      // Cleanup test data
      db.prepare('DELETE FROM khata_transactions WHERE bill_id = ?').run(billId);
      db.prepare('DELETE FROM payment_allocations WHERE bill_id = ?').run(billId);
      db.prepare('DELETE FROM payments WHERE id IN (SELECT p.id FROM payments p JOIN payment_allocations pa ON p.id = pa.payment_id WHERE pa.bill_id = ?)').run(billId);
      db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run(billId);
      db.prepare('DELETE FROM bills WHERE id = ?').run(billId);
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('7. Bill Rollback on Failure', () => {
    try {
      const db = connection.getDb();
      const beforeCount = db.prepare('SELECT COUNT(*) as count FROM bills').get().count;

      try {
        TransactionManager.execute((txDb) => {
          txDb.prepare(`
            INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date, grand_total, paid_amount, balance_amount)
            VALUES ('TEST-ROLLBACK-BILL', 'gst', 1, 1, '2026-07-01', 5000, 0, 5000)
          `).run();

          txDb.prepare(`INSERT INTO bill_items (bill_id, item_type, description, total) VALUES (999999, 'manual', 'Orphan', 100)`).run();
        });
        assert(false, 'Transaction should have failed');
      } catch (e) {
        assert(true, 'Transaction rolled back on error');
      }

      const afterCount = db.prepare('SELECT COUNT(*) as count FROM bills').get().count;
      assertEqual(afterCount, beforeCount, 'No orphan bill left after rollback');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('8. Inventory Update', async () => {
    try {
      const db = connection.getDb();
      // Create a category first to satisfy FK
      db.prepare(`INSERT INTO categories (name) VALUES ('Test Category')`).run();
      const catId = db.lastInsertRowid;

      db.prepare(`
        INSERT INTO products (product_name, category_id, quantity_in_stock, selling_price)
        VALUES ('Test Gold Ring', ?, 10, 5000)
      `).run(catId);

      const product = db.prepare("SELECT id, quantity_in_stock FROM products WHERE product_name = 'Test Gold Ring'").get();

      TransactionManager.execute((txDb) => {
        txDb.prepare(`
          INSERT INTO inventory_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, user_id, notes)
          VALUES (?, 'sold', ?, -2, ?, 1, 'Test sale')
        `).run(product.id, product.quantity_in_stock, product.quantity_in_stock - 2);

        txDb.prepare(`UPDATE products SET quantity_in_stock = quantity_in_stock - 2 WHERE id = ?`).run(product.id);
      });

      const updated = db.prepare('SELECT quantity_in_stock FROM products WHERE id = ?').get(product.id);
      assertEqual(updated.quantity_in_stock, 8, 'Stock reduced correctly');

      const movements = db.prepare('SELECT * FROM inventory_movements WHERE product_id = ?').all(product.id);
      assert(movements.length === 1, 'Inventory movement recorded');
      assertEqual(movements[0].quantity_change, -2, 'Movement quantity change correct');

      // Cleanup
      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(product.id);
      db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('9. Manual Bill Item', () => {
    try {
      const db = connection.getDb();
      const customerId = db.prepare("SELECT id FROM customers WHERE customer_id = 'TEST-CUST-001'").get().id;

      const billResult = db.prepare(`
        INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date, grand_total, paid_amount, balance_amount)
        VALUES ('TEST-MANUAL-INV', 'non_gst', ?, 1, '2026-07-02', 1500, 1500, 0)
      `).run(customerId);
      const billId = db.lastInsertRowid;

      db.prepare(`
        INSERT INTO bill_items (bill_id, item_type, description, quantity, rate, total)
        VALUES (?, 'manual', 'Repair Charge - Gold Chain', 1, 1500, 1500)
      `).run(billId);

      const item = db.prepare("SELECT * FROM bill_items WHERE bill_id = ? AND item_type = 'manual'").get(billId);
      assert(item !== null, 'Manual bill item saved');
      assertEqual(item.description, 'Repair Charge - Gold Chain', 'Manual item description preserved');
      assertEqual(item.product_id, null, 'Manual item has no product reference');

      // Cleanup
      db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run(billId);
      db.prepare('DELETE FROM bills WHERE id = ?').run(billId);
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('10. Partial Payment', () => {
    try {
      const db = connection.getDb();
      const customerId = db.prepare("SELECT id FROM customers WHERE customer_id = 'TEST-CUST-001'").get().id;

      const billResult = db.prepare(`
        INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date, grand_total, paid_amount, balance_amount, payment_status)
        VALUES ('TEST-PARTIAL-INV', 'gst', ?, 1, '2026-07-03', 50000, 20000, 30000, 'partial')
      `).run(customerId);
      const billId = db.lastInsertRowid;

      const pay1 = db.prepare(`
        INSERT INTO payments (customer_id, user_id, payment_date, amount, payment_method, type)
        VALUES (?, 1, '2026-07-03', 20000, 'upi', 'bill_payment')
      `).run(customerId);
      const pay1Id = db.lastInsertRowid;

      db.prepare(`INSERT INTO payment_allocations (payment_id, bill_id, amount) VALUES (?, ?, ?)`).run(pay1Id, billId, 20000);

      const pay2 = db.prepare(`
        INSERT INTO payments (customer_id, user_id, payment_date, amount, payment_method, type)
        VALUES (?, 1, '2026-07-10', 15000, 'cash', 'bill_payment')
      `).run(customerId);
      const pay2Id = db.lastInsertRowid;

      db.prepare(`INSERT INTO payment_allocations (payment_id, bill_id, amount) VALUES (?, ?, ?)`).run(pay2Id, billId, 15000);

      const allocations = db.prepare('SELECT SUM(amount) as total FROM payment_allocations WHERE bill_id = ?').get(billId);
      assertEqual(allocations.total, 35000, 'Partial payments sum correctly (20000 + 15000)');

      // Cleanup
      db.prepare('DELETE FROM payment_allocations WHERE bill_id = ?').run(billId);
      db.prepare('DELETE FROM payments WHERE id IN (?, ?)').run(pay1Id, pay2Id);
      db.prepare('DELETE FROM bills WHERE id = ?').run(billId);
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('11. Khata Update', () => {
    try {
      const db = connection.getDb();
      const customerId = db.prepare("SELECT id FROM customers WHERE customer_id = 'TEST-CUST-001'").get().id;

      TransactionManager.execute((txDb) => {
        txDb.prepare(`
          INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, user_id)
          VALUES (?, '2026-07-04', 'bill', 20000, 0, 20000, 1)
        `).run(customerId);

        txDb.prepare(`
          INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, user_id)
          VALUES (?, '2026-07-04', 'payment', 0, 5000, 15000, 1)
        `).run(customerId);
      });

      const lastTx = db.prepare(`
        SELECT * FROM khata_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 1
      `).get(customerId);

      assertEqual(lastTx.balance, 15000, 'Khata balance correctly shows 15000');
      assertEqual(lastTx.credit, 5000, 'Khata credit correct');

      // Cleanup
      db.prepare('DELETE FROM khata_transactions WHERE customer_id = ? AND transaction_date = ?', customerId, '2026-07-04');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('12. Opening Balance (Migrated Data)', () => {
    try {
      const db = connection.getDb();
      const customerId = db.prepare("SELECT id FROM customers WHERE customer_id = 'TEST-CUST-001'").get().id;

      db.prepare(`
        INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, notes, user_id, data_source)
        VALUES (?, '2025-12-31', 'opening_balance', 25000, 0, 25000, 'Opening balance', 1, 'migrated')
      `).run(customerId);

      const record = db.prepare("SELECT * FROM khata_transactions WHERE transaction_type = 'opening_balance' AND data_source = 'migrated'").get();
      assert(record !== null, 'Migrated record identifiable');
      assertEqual(record.debit, 25000, 'Opening balance debit correct');

      db.prepare('DELETE FROM khata_transactions WHERE id = ?').run(record.id);
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('13. Schema Versioning', () => {
    try {
      const db = connection.getDb();
      const migrations = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
      assert(migrations.length > 0, 'Schema migrations table populated');
      assertEqual(migrations[0].version, 1, 'Initial schema version is 1');
      assertEqual(migrations[0].success, 1, 'Initial migration succeeded');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('14. Migration Manager', () => {
    try {
      const mm = new MigrationManager(path.join(__dirname, '..', 'database', 'migrations'));
      const status = mm.getMigrationStatus();
      assert(status.currentVersion >= 1, 'Current version >= 1');
      assert(Array.isArray(status.applied), 'Applied migrations list exists');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('15. BaseRepository CRUD', () => {
    try {
      const repo = new BaseRepository('customers');

      const allCustomers = repo.findAll();
      assert(allCustomers.length > 0, 'findAll returns customers');

      const firstId = allCustomers[0].id;
      const found = repo.findById(firstId);
      assert(found !== null, 'findById works');
      assertEqual(found.id, firstId, 'findById returns correct record');

      const count = repo.count();
      assert(count > 0, 'Count works');

      const pageResult = repo.paginate({ page: 1, pageSize: 5 });
      assert(pageResult.data.length <= 5, 'Pagination returns <= 5 records');
      assert(pageResult.pagination.page === 1, 'Pagination page correct');
      assert(pageResult.pagination.totalPages >= 1, 'Pagination totalPages correct');

      const exists = repo.exists({ customer_id: 'TEST-CUST-001' });
      assert(exists, 'Exists check works');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('16. Bill Type Constraints', () => {
    try {
      const db = connection.getDb();
      let threw = false;
      try {
        db.prepare(`
          INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date, grand_total, paid_amount, balance_amount)
          VALUES ('TEST-INVALID-TYPE', 'invalid_type', 1, 1, '2026-07-01', 100, 0, 100)
        `).run();
      } catch (e) {
        threw = true;
      }
      assert(threw, 'Invalid bill_type rejected by CHECK constraint');

      threw = false;
      try {
        db.prepare(`
          INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date, grand_total, paid_amount, balance_amount, status)
          VALUES ('TEST-INVALID-STATUS', 'gst', 1, 1, '2026-07-01', 100, 0, 100, 'invalid_status')
        `).run();
      } catch (e) {
        threw = true;
      }
      assert(threw, 'Invalid status rejected by CHECK constraint');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('17. Shop Settings Single Row', () => {
    try {
      const db = connection.getDb();
      const settings = db.prepare('SELECT * FROM shop_settings').all();
      assertEqual(settings.length, 1, 'Only one shop settings row exists');

      let threw = false;
      try {
        db.prepare('INSERT INTO shop_settings (id) VALUES (2)').run();
      } catch (e) {
        threw = true;
      }
      assert(threw, 'Cannot insert second shop_settings row');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('18. App Settings Single Row', () => {
    try {
      const db = connection.getDb();
      const settings = db.prepare('SELECT * FROM app_settings').all();
      assertEqual(settings.length, 1, 'Only one app settings row exists');

      let threw = false;
      try {
        db.prepare('INSERT INTO app_settings (id, schema_version) VALUES (2, 1)').run();
      } catch (e) {
        threw = true;
      }
      assert(threw, 'Cannot insert second app_settings row');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('19. Indexes Exist', () => {
    try {
      const db = connection.getDb();
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name").all();
      const indexNames = indexes.map(i => i.name);

      const expectedIndexes = [
        'idx_bills_customer', 'idx_bills_date', 'idx_customers_name',
        'idx_customers_phone1', 'idx_khata_customer', 'idx_payments_customer',
        'idx_activity_user', 'idx_inv_mov_product', 'idx_bill_items_bill',
        'idx_products_category', 'idx_comm_customer'
      ];

      for (const idx of expectedIndexes) {
        assert(indexNames.includes(idx), `Index '${idx}' exists`);
      }
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('20. Activity Log Creation', () => {
    try {
      const db = connection.getDb();

      db.prepare(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(1, 'test_action', 'test', 1, 'Test log entry');

      const testLog = db.prepare("SELECT * FROM activity_logs WHERE action = 'test_action'").get();
      assert(testLog !== null, 'Custom activity log created');
      assertEqual(testLog.description, 'Test log entry', 'Activity log description preserved');

      db.prepare("DELETE FROM activity_logs WHERE action = 'test_action'").run();
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  await testGroup('21. Backup Creation & Verification', () => {
    try {
      const bm = new BackupManager();
      const backupDir = path.join(__dirname, 'test_backups');
      bm.setBackupDir(backupDir);

      const backup = bm.createBackup({ userId: 1 });
      assert(backup.path !== null, 'Backup file created');
      assert(fs.existsSync(backup.path), 'Backup file exists on disk');
      assert(backup.fileHash.length === 64, 'Backup has SHA-256 hash');
      assert(backup.fileSize > 0, 'Backup has non-zero size');

      const history = connection.getDb().prepare('SELECT * FROM backup_history ORDER BY id DESC LIMIT 1').get();
      assert(history !== null, 'Backup history recorded');
      assertEqual(history.status, 'completed', 'Backup status completed');

      if (fs.existsSync(backup.path)) fs.unlinkSync(backup.path);
      if (fs.existsSync(backupDir)) fs.rmdirSync(backupDir);
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // ======================================
  // CLEANUP: Remove test customer and all test data
  await testGroup('Cleanup', () => {
    try {
      const db = connection.getDb();
      db.prepare(`DELETE FROM customers WHERE customer_id = 'TEST-CUST-001'`).run();
      const deleted = db.prepare("SELECT * FROM customers WHERE customer_id = 'TEST-CUST-001'").get();
      assert(!deleted, 'Test customer cleaned up');
    } catch (err) {
      console.error('  ERROR:', err.message);
      failed++;
    }
  });

  // Cleanup
  connection.close();
  cleanup();

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
