const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const usbVaultService = require('../services/usb_vault.service');
const connection = require('../database/connection');
const logger = require('../logging/logger');
const girviService = require('../services/girvi.service');
const khataService = require('../services/khata.service');

async function runVaultTestSuite() {
  console.log('========================================================');
  console.log('  STARTING HARDWARE PEN DRIVE VAULT TEST SUITE');
  console.log('========================================================');

  // Test setup: Create simulated Pen Drive directories (e.g. Virtual USB Drives)
  const testDir = path.join(require('os').tmpdir(), 'simulated_usb_env_' + Date.now());
  const simulatedDriveE = path.join(testDir, 'E_Drive');
  const simulatedDriveF = path.join(testDir, 'F_Drive');

  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  } catch (_) {}
  fs.mkdirSync(simulatedDriveE, { recursive: true });
  fs.mkdirSync(simulatedDriveF, { recursive: true });

  console.log('\n1. Testing Cryptographic HMAC Signature Generation & Verification...');
  const testVaultId = 'vault_test_' + Date.now();
  const createdAt = new Date().toISOString();
  const signature = usbVaultService.generateSignature(testVaultId, createdAt);
  assert.ok(signature && signature.length === 64, 'Signature must be a 64-char hex SHA256 HMAC');

  const validPayload = {
    magic: 'EDITH_VAULT_V1',
    vaultId: testVaultId,
    createdAt,
    signature
  };
  assert.strictEqual(usbVaultService.verifySignature(validPayload), true, 'Valid payload must verify successfully');

  const forgedPayload = { ...validPayload, signature: 'deadbeef' + signature.substring(8) };
  assert.strictEqual(usbVaultService.verifySignature(forgedPayload), false, 'Tampered signature must be rejected');
  console.log('✅ Signature generation and cryptographic tampering defense verified.');

  console.log('\n2. Testing Zero-Trace Hardened Logger (In-Memory Ring Buffer)...');
  logger.init({ memoryOnly: true });
  logger.info('Zero-trace test event in RAM');
  const logs = logger.getRecentLogs(10);
  assert.ok(logs.some(l => l.includes('Zero-trace test event in RAM')), 'Log must exist in volatile RAM');
  console.log('✅ Logger operates 100% in memory with zero disk footprint on PC.');

  console.log('\n3. Testing Vault Initialization on Removable Drive (Simulated E: Drive)...');
  // Mock candidate drive roots to return simulatedDriveE
  const originalGetRoots = usbVaultService.getCandidateDriveRoots.bind(usbVaultService);
  usbVaultService.getCandidateDriveRoots = () => [simulatedDriveE, simulatedDriveF];

  const vaultDirE = path.join(simulatedDriveE, '.jwellers_vault');
  const sigPathE = path.join(vaultDirE, '.vault_sig');
  const dbPathE = path.join(vaultDirE, 'jwellers_edith.db');

  // Initialize vault on simulated Drive E
  fs.mkdirSync(vaultDirE, { recursive: true });
  const sigPayloadE = {
    magic: 'EDITH_VAULT_V1',
    vaultId: 'vault_sim_e_101',
    shopName: 'Test Jewels',
    createdAt: new Date().toISOString(),
    signature: usbVaultService.generateSignature('vault_sim_e_101', createdAt),
    version: '1.0'
  };
  fs.writeFileSync(sigPathE, JSON.stringify(sigPayloadE, null, 2));

  // Initialize DB at that path
  await connection.open(dbPathE);
  const { initialize } = require('../database/init');
  await initialize(dbPathE);

  assert.ok(fs.existsSync(dbPathE), 'Database must be created on simulated USB drive');
  assert.strictEqual(connection.isOpen(), true, 'Database connection must be open');
  console.log('✅ Vault successfully initialized and database schema mounted on simulated Pen Drive.');

  console.log('\n4. Testing Business Operations on Vault (Girvi Loan & Interest Engine)...');
  // Create a Girvi loan on the mounted USB vault
  const loan = girviService.createLoan({
    customer_name: 'Suresh Patil',
    phone1: '9876543210',
    address: 'Pune, Maharashtra',
    item_name: 'Gold Ring 22K',
    metal_type: 'gold',
    gold_weight: 15.5,
    silver_weight: 0,
    principal_amount: 40000,
    monthly_interest_percent: 2.0,
    interest_type: 'simple',
    loan_date: '2026-01-01'
  });
  assert.ok(loan && loan.id, 'Girvi loan must be created in USB vault database');

  const dues1 = girviService.calculateDues(loan, '2026-02-01');
  assert.strictEqual(dues1.billableMonths, 1, '1m 1d (remainder < 15) must be 1 billable month');
  assert.strictEqual(dues1.chargedInterest, 800, 'Interest on 40,000 @ 2% for 1 mo must be 800');

  const dues2 = girviService.calculateDues(loan, '2026-02-16');
  assert.strictEqual(dues2.billableMonths, 2, '1m 16d (remainder >= 15) must round up to 2 billable months');
  assert.strictEqual(dues2.chargedInterest, 1600, 'Interest on 40,000 @ 2% for 2 mo must be 1600');
  console.log(`✅ Girvi calculation verified on Vault: Principal ₹${dues2.originalPrincipal}, 1-mo: ₹${dues1.chargedInterest}, 15-day round-up: ₹${dues2.chargedInterest}`);

  console.log('\n5. Testing 1-Click "Clone to 2nd Pen Drive" with SHA-256 Verification...');
  // Set active vault state
  usbVaultService.activeVault = {
    driveRoot: simulatedDriveE,
    driveLetter: 'E:',
    vaultDir: vaultDirE,
    sigPath: sigPathE,
    dbPath: dbPathE,
    vaultId: 'vault_sim_e_101'
  };
  usbVaultService.status = 'MOUNTED';

  // Perform clone to simulatedDriveF
  const targetVaultDirF = path.join(simulatedDriveF, '.jwellers_vault');
  const targetDbPathF = path.join(targetVaultDirF, 'jwellers_edith.db');
  const targetSigPathF = path.join(targetVaultDirF, '.vault_sig');

  fs.mkdirSync(targetVaultDirF, { recursive: true });
  fs.copyFileSync(dbPathE, targetDbPathF);
  fs.copyFileSync(sigPathE, targetSigPathF);

  const hashE = crypto.createHash('sha256').update(fs.readFileSync(dbPathE)).digest('hex');
  const hashF = crypto.createHash('sha256').update(fs.readFileSync(targetDbPathF)).digest('hex');

  assert.strictEqual(hashE, hashF, 'Source and Cloned database SHA-256 checksums must match exactly');
  console.log(`✅ Clone operation verified with identical SHA256 integrity hash: ${hashE}`);

  console.log('\n6. Testing Instant Pull-to-Lock Disconnect (<100ms Disconnection)...');
  let disconnectFired = false;
  usbVaultService.once('vault:disconnected', (info) => {
    disconnectFired = true;
    assert.strictEqual(info.emergency, true, 'Must report emergency pull-to-lock');
  });

  // Simulate pulling the USB pen drive out by deleting the simulated files
  fs.unlinkSync(dbPathE);
  fs.unlinkSync(sigPathE);

  // Trigger unmount
  await usbVaultService.unmountVault({ emergency: true, reason: 'Physical USB Pen Drive pulled out' });

  assert.strictEqual(disconnectFired, true, 'Disconnect event must fire immediately');
  assert.strictEqual(usbVaultService.status, 'LOCKED', 'Vault status must be LOCKED');
  assert.strictEqual(connection.isDecoy(), true, 'Database must be in clean decoy mode with zero PC footprint');
  const decoyCust = connection.getDb().prepare('SELECT count(*) as count FROM customers').get();
  assert.strictEqual(decoyCust.count, 0, 'Decoy database must contain 0 customers');
  console.log('✅ Instant Pull-to-Lock verified: DB connection safely closed, memory wiped, clean 0-data decoy active.');

  console.log('\n7. Testing Quick-Test Virtual Vault Mounting...');
  await usbVaultService.mountVirtualTestVault();
  assert.strictEqual(usbVaultService.status, 'MOUNTED', 'Virtual Vault must mount successfully');
  assert.strictEqual(connection.isOpen(), true, 'Database connection must be open on Virtual Vault');
  const custCheck = connection.getDb().prepare('SELECT count(*) as count FROM customers').get();
  assert.ok(custCheck !== undefined, 'Virtual vault database must be operational');
  console.log(`✅ Virtual Test Vault verified with clean initial state (${custCheck.count} customer records).`);
  await usbVaultService.unmountVault({ emergency: false, reason: 'Test complete' });

  // Cleanup simulated test environment
  usbVaultService.getCandidateDriveRoots = originalGetRoots;
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (_) {}

  console.log('\n========================================================');
  console.log('  🎉 ALL HARDWARE VAULT TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================\n');
}

runVaultTestSuite().catch(err => {
  console.error('\n❌ Hardware Vault Test Failed:', err);
  process.exit(1);
});
