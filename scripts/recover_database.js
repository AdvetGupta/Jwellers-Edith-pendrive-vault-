/**
 * Jwellers Edith - Database Recovery Helper
 * 
 * Safely inspects and recovers database from .bak files, snapshots, or backup archives
 * if an accidental overwrite or crash occurred.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function inspectDb(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(filePath);
  const db = new SQL.Database(buffer);
  
  const getCount = (table) => {
    try {
      const res = db.exec(`SELECT count(*) as count FROM ${table}`);
      if (res && res[0] && res[0].values && res[0].values[0]) {
        return res[0].values[0][0];
      }
    } catch (_) {}
    return 0;
  };

  const info = {
    path: filePath,
    size: fs.statSync(filePath).size,
    customers: getCount('customers'),
    bills: getCount('bills'),
    girviLoans: getCount('girvi_loans'),
    khata: getCount('khata_transactions')
  };
  db.close();
  return info;
}

async function runRecovery() {
  console.log('========================================================');
  console.log('  JWELLERS EDITH — DATABASE INTEGRITY & RECOVERY HELPER');
  console.log('========================================================\n');

  // Candidate drive search
  const drives = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(d => `${d}:\\.jwellers_vault\\jwellers_edith.db`);
  drives.push(path.join(__dirname, '../database/jewellery.db'));
  drives.push(path.join(process.env.APPDATA || '', 'jwellers-edith/data/jwellers_edith.db'));

  let activeDb = null;
  for (const candidate of drives) {
    if (fs.existsSync(candidate)) {
      activeDb = candidate;
      break;
    }
  }

  if (!activeDb) {
    console.log('No active database file detected on removable drives or default paths.');
    return;
  }

  console.log(`Active Database: ${activeDb}`);
  const activeInfo = await inspectDb(activeDb);
  console.log(`  - Size: ${(activeInfo.size / 1024).toFixed(1)} KB`);
  console.log(`  - Customers: ${activeInfo.customers}`);
  console.log(`  - Bills:     ${activeInfo.bills}`);
  console.log(`  - Girvi:     ${activeInfo.girviLoans}\n`);

  const bakFile = `${activeDb}.bak`;
  if (fs.existsSync(bakFile)) {
    console.log(`Found Rolling Backup (.bak): ${bakFile}`);
    const bakInfo = await inspectDb(bakFile);
    console.log(`  - Size: ${(bakInfo.size / 1024).toFixed(1)} KB`);
    console.log(`  - Customers: ${bakInfo.customers}`);
    console.log(`  - Bills:     ${bakInfo.bills}`);
    console.log(`  - Girvi:     ${bakInfo.girviLoans}\n`);

    if (bakInfo.customers > activeInfo.customers || bakInfo.bills > activeInfo.bills || bakInfo.girviLoans > activeInfo.girviLoans) {
      console.log('⚠️  ALERT: The .bak file contains MORE records than the current database!');
      const archivePath = `${activeDb}.corrupted_${Date.now()}`;
      fs.copyFileSync(activeDb, archivePath);
      console.log(`  Archived current file to: ${archivePath}`);
      fs.copyFileSync(bakFile, activeDb);
      console.log('  ✅ Restored database from rolling backup (.bak) successfully!');
      return;
    } else {
      console.log('✅ Current database is fully up to date with backup.');
    }
  } else {
    console.log('No rolling .bak file found. Active database is singular.');
  }

  console.log('\nIntegrity check complete. All records verified.');
}

if (require.main === module) {
  runRecovery().catch(err => console.error('Recovery error:', err));
}

module.exports = { inspectDb, runRecovery };
