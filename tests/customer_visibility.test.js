const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { open, close, getDb } = require('../database/connection');
const { initialize } = require('../database/init');
const customerRepository = require('../repositories/customer.repository');
const khataRepository = require('../repositories/khata.repository');
const customerService = require('../services/customer.service');
const BackupManager = require('../database/backup_manager');

async function runCustomerVisibilityTest() {
  console.log('--- Starting Customer Visibility Test Suite ---');
  const testDbPath = path.join(__dirname, 'test_customer_visibility.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  await open(testDbPath);
  await initialize();
  const db = getDb();

  console.log('1. Seeding 286 initial customers...');
  db.exec('BEGIN TRANSACTION;');
  for (let i = 1; i <= 286; i++) {
    const pad = String(i).padStart(4, '0');
    db.prepare(`
      INSERT INTO customers (customer_id, name, phone1, city, is_archived, is_deleted)
      VALUES (?, ?, ?, ?, 0, 0)
    `).run(`CUST-${pad}`, `Old Customer ${i}`, `98765${pad}`, i % 2 === 0 ? 'Mumbai' : 'Delhi');
  }
  db.exec('COMMIT;');

  const countsInitial = customerRepository.getCounts();
  console.log(`Initial customer count: total=${countsInitial.total}, active=${countsInitial.active}`);
  assert.strictEqual(countsInitial.total, 286, 'Should have 286 initial customers');

  console.log('2. Adding 38 new customers (total 324)...');
  db.exec('BEGIN TRANSACTION;');
  for (let i = 287; i <= 324; i++) {
    const pad = String(i).padStart(4, '0');
    db.prepare(`
      INSERT INTO customers (customer_id, name, phone1, city, address, is_archived, is_deleted)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(`CUST-${pad}`, `New Customer ${i}`, `99900${pad}`, 'Bangalore', 'MG Road');
  }
  db.exec('COMMIT;');

  const countsTotal = customerRepository.getCounts();
  console.log(`Updated customer count: total=${countsTotal.total}, active=${countsTotal.active}`);
  assert.strictEqual(countsTotal.total, 324, 'Total customers should be 324');
  assert.strictEqual(countsTotal.active, 324, 'Active customers should be 324');

  console.log('3. Testing large fetch (pageSize: 10000)...');
  const searchAllResult = customerRepository.search({ pageSize: 10000, is_archived: false });
  console.log(`Fetched ${searchAllResult.data.length} records out of total ${searchAllResult.pagination.total}`);
  assert.strictEqual(searchAllResult.data.length, 324, 'Should fetch all 324 customers without 200 truncation cap');

  console.log('4. Testing Khata getAllCustomersWithBalance()...');
  const khataCustomers = khataRepository.getAllCustomersWithBalance();
  console.log(`Khata returned ${khataCustomers.length} active customers`);
  assert.strictEqual(khataCustomers.length, 324, 'Khata should list all 324 active customers');

  console.log('5. Testing search across fields (formatted phone, city, address, ID)...');
  // Formatted phone search test
  const phoneSearch = customerRepository.search({ search: '99900 0287' });
  assert.strictEqual(phoneSearch.data.length, 1, 'Should find customer with formatted phone number');
  assert.strictEqual(phoneSearch.data[0].customer_id, 'CUST-0287');

  // Address search test
  const addressSearch = customerRepository.search({ search: 'MG Road' });
  assert.strictEqual(addressSearch.data.length, 38, 'Should find all 38 new customers matching address');

  // City search test
  const citySearch = customerRepository.search({ search: 'Bangalore' });
  assert.strictEqual(citySearch.data.length, 38, 'Should find all 38 new customers matching city');

  console.log('6. Testing Database Integrity Verification...');
  const integrity = customerService.verifyIntegrity();
  console.log('Integrity check output:', integrity);
  assert.strictEqual(integrity.healthy, true, 'Integrity check should pass healthy');
  assert.strictEqual(integrity.totalCustomers, 324, 'Integrity check total customers should be 324');

  console.log('7. Testing BackupManager CSV export...');
  const backupMgr = new BackupManager();
  const backupDir = path.join(__dirname, 'test_backup_dir');
  const backupRes = backupMgr.createBackup({ backupDir });
  const custCsvPath = path.join(path.dirname(backupRes.path), 'Customers.csv');
  assert.ok(fs.existsSync(custCsvPath), 'Customers.csv backup file should exist');
  const csvContent = fs.readFileSync(custCsvPath, 'utf8');
  const csvLines = csvContent.trim().split('\n').filter(l => l.length > 0);
  console.log(`Backup CSV lines: ${csvLines.length} (header + ${csvLines.length - 1} rows)`);
  assert.strictEqual(csvLines.length - 1, 324, 'Backup CSV should contain exactly 324 customer rows');

  close();
  // Cleanup
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });

  console.log('--- ✅ All 7 Customer Visibility Tests Passed Successfully! ---');
}

runCustomerVisibilityTest().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
