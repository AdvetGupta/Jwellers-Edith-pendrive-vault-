const path = require('path');
const fs = require('fs');
const connection = require('./connection');
const MigrationManager = require('./migration_manager');

async function initialize(databasePath) {
  let db;
  if (databasePath) {
    db = await connection.open(databasePath);
  } else if (connection.isOpen()) {
    db = connection.getDb();
  } else {
    db = await connection.openDecoy();
  }
  const migrationManager = new MigrationManager(path.join(__dirname, 'migrations'));

  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error('Schema file not found: ' + schemaPath);
  }

  console.log('Initializing database schema...');

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Run PRAGMAs outside transaction — WAL mode changes cannot run inside a transaction
  // Run everything else as a single exec (sql.js exec supports multi-statement SQL)
  const pragmaLines = [];
  const otherLines = [];
  for (const line of schemaSql.split('\n')) {
    if (/^\s*PRAGMA\s/i.test(line)) {
      pragmaLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  // Execute pragma statements individually (outside any transaction)
  for (const pragma of pragmaLines) {
    const trimmed = pragma.trim();
    if (trimmed) {
      try {
        db._raw.exec(trimmed);
      } catch (e) {
        // WAL mode may not be available in sql.js in-memory mode; non-fatal
        console.warn(`PRAGMA warning (non-fatal): ${e.message}`);
      }
    }
  }

  // Execute the rest of the schema (CREATE TABLE IF NOT EXISTS etc.)
  // Use _raw.exec() directly for multi-statement SQL support
  try {
    db._raw.exec(otherLines.join('\n'));
    console.log('Schema created/verified successfully.');
  } catch (error) {
    console.error('Schema creation failed:', error.message);
    throw error;
  }

  ensureDefaultData(db);

  const migrationResult = migrationManager.runMigrations({ appliedBy: 'init' });
  if (migrationResult.applied && migrationResult.applied.length > 0) {
    console.log(migrationResult.message);
  }

  // Ensure interest_type column exists in girvi_loans
  try {
    const tableInfo = db.pragma('table_info(girvi_loans)');
    if (tableInfo && tableInfo.length > 0) {
      const hasInterestType = tableInfo.some(col => col.name === 'interest_type');
      if (!hasInterestType) {
        db.prepare("ALTER TABLE girvi_loans ADD COLUMN interest_type TEXT NOT NULL DEFAULT 'simple'").run();
        console.log('Added interest_type column to girvi_loans.');
      }
      const hasDeletedAt = tableInfo.some(col => col.name === 'deleted_at');
      if (!hasDeletedAt) {
        db.prepare("ALTER TABLE girvi_loans ADD COLUMN deleted_at TEXT").run();
        console.log('Added deleted_at column to girvi_loans.');
      }
      const hasLastInterestDate = tableInfo.some(col => col.name === 'last_interest_date');
      if (!hasLastInterestDate) {
        db.prepare("ALTER TABLE girvi_loans ADD COLUMN last_interest_date TEXT").run();
        console.log('Added last_interest_date column to girvi_loans.');
      }
      db.prepare("UPDATE girvi_loans SET last_interest_date = loan_date WHERE last_interest_date IS NULL OR last_interest_date = ''").run();
      try {
        db.prepare(`
          UPDATE girvi_loans
          SET last_interest_date = (
            SELECT MAX(transaction_date)
            FROM girvi_transactions
            WHERE girvi_transactions.girvi_loan_id = girvi_loans.id
              AND girvi_transactions.interest_component > 0
          )
          WHERE id IN (
            SELECT girvi_loan_id
            FROM girvi_transactions
            WHERE interest_component > 0
          ) AND (last_interest_date IS NULL OR last_interest_date = loan_date)
        `).run();
      } catch (_) {}
    }
  } catch (err) {
    // Table might not exist yet
  }

  // Ensure deleted_at column exists in customers
  try {
    const custInfo = db.pragma('table_info(customers)');
    if (custInfo && custInfo.length > 0) {
      const hasDeletedAt = custInfo.some(col => col.name === 'deleted_at');
      if (!hasDeletedAt) {
        db.prepare("ALTER TABLE customers ADD COLUMN deleted_at TEXT").run();
        console.log('Added deleted_at column to customers.');
      }
      const hasRelation = custInfo.some(col => col.name === 'relation');
      if (!hasRelation) {
        db.prepare("ALTER TABLE customers ADD COLUMN relation TEXT").run();
        console.log('Added relation column to customers.');
      }
    }
  } catch (err) {
    // Non-fatal
  }



  // Ensure sync_tombstones table exists
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sync_tombstones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_name TEXT NOT NULL,
        entity_id INTEGER,
        entity_key TEXT,
        deleted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )
    `).run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tombstones_key ON sync_tombstones(entity_name, entity_key)").run();
  } catch (err) {
    // Non-fatal
  }

  const version = migrationManager.getCurrentVersion();
  console.log(`Database schema version: ${version}`);

  // Save immediately after initialization
  db._saveToFile();

  return db;
}

function ensureDefaultData(db) {
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (roleCount.count === 0) {
    db.prepare("INSERT INTO roles (name, description, is_system) VALUES ('owner', 'Shop owner with full access', 1)").run();
    db.prepare("INSERT INTO roles (name, description, is_system) VALUES ('staff', 'Staff with limited permissions', 1)").run();
    console.log('Default roles created.');
  }

  const appSettingsCount = db.prepare('SELECT COUNT(*) as count FROM app_settings').get();
  if (appSettingsCount.count === 0) {
    db.prepare(`INSERT INTO app_settings (id, schema_version, db_created_at) VALUES (1, 1, datetime('now', 'localtime'))`).run();
    console.log('App settings initialized.');
  }

  const shopSettingsCount = db.prepare('SELECT COUNT(*) as count FROM shop_settings').get();
  if (shopSettingsCount.count === 0) {
    db.prepare(`INSERT INTO shop_settings (id) VALUES (1)`).run();
    console.log('Shop settings initialized.');
  }

  // Seed all permission codes so they can be assigned to staff
  const permCount = db.prepare('SELECT COUNT(*) as count FROM permissions').get();
  if (permCount.count === 0) {
    const allPermissions = [
      ['dashboard.view',    'View Dashboard',        'dashboard'],
      ['customer.view',     'View Customers',        'customers'],
      ['customer.create',   'Create Customers',      'customers'],
      ['customer.edit',     'Edit Customers',        'customers'],
      ['customer.delete',   'Delete Customers',      'customers'],
      ['inventory.view',    'View Inventory',        'inventory'],
      ['inventory.adjust',  'Adjust Stock',          'inventory'],
      ['product.create',    'Create Products',       'inventory'],
      ['product.edit',      'Edit Products',         'inventory'],
      ['product.delete',    'Delete Products',       'inventory'],
      ['bill.view',         'View Bills',            'billing'],
      ['bill.create',       'Create Bills',          'billing'],
      ['bill.cancel',       'Cancel Bills',          'billing'],
      ['payment.view',      'View Payments',         'billing'],
      ['payment.create',    'Record Payments',       'billing'],
      ['khata.view',        'View Khata',            'khata'],
      ['khata.adjust',      'Adjust Khata',          'khata'],
      ['report.view',       'View Reports',          'reports'],
      ['staff.create',      'Create Staff',          'administration'],
      ['staff.edit',        'Edit Staff',            'administration'],
      ['staff.delete',      'Delete Staff',          'administration'],
      ['settings.view',     'View Settings',         'administration'],
      ['settings.edit',     'Edit Settings',         'administration'],
      ['backup.create',     'Create Backup',         'administration'],
      ['backup.restore',    'Restore Backup',        'administration'],
      ['activity.view',     'View Activity Log',     'administration'],
      ['communication.send','Send Communications',   'communication']
    ];
    const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (code, name, module) VALUES (?, ?, ?)');
    for (const [code, name, module] of allPermissions) {
      insertPerm.run(code, name, module);
    }
    console.log(`Seeded ${allPermissions.length} permissions.`);

    // Give staff role a sensible default set of permissions
    const staffRole = db.prepare("SELECT id FROM roles WHERE name = 'staff'").get();
    if (staffRole) {
      const staffPermCodes = [
        'dashboard.view', 'customer.view', 'customer.create', 'customer.edit',
        'inventory.view', 'bill.view', 'bill.create', 'payment.view', 'payment.create',
        'khata.view', 'report.view', 'communication.send'
      ];
      const insertRolePerm = db.prepare(`
        INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT ?, id FROM permissions WHERE code = ?
      `);
      for (const code of staffPermCodes) {
        insertRolePerm.run(staffRole.id, code);
      }
      console.log('Default staff permissions assigned.');
    }
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('No users found — first-time setup required.');
  }
}

async function initializeAndExit() {
  try {
    await initialize();
    console.log('Database initialization complete.');
    process.exit(0);
  } catch (error) {
    console.error('Initialization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeAndExit();
}

module.exports = { initialize, ensureDefaultData };
