const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb, getPath } = require('./connection');
const { Database } = require('./sqlite_shim');

class BackupManager {
  constructor(options = {}) {
    this.backupDir = options.backupDir || null;
  }

  setBackupDir(dir) {
    this.backupDir = dir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  generateBackupFileName() {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `jwellers_edith_backup_${dateStr}.db`;
  }

  createBackup(options = {}) {
    const db = getDb();
    const sourcePath = getPath();

    const backupDir = options.backupDir || this.backupDir || path.dirname(sourcePath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Create a user-friendly backup folder instead of a raw binary .db file
    let backupFolder;
    let backupFileName = options.fileName || 'jwellers_edith_database.db';
    
    if (options.isUpdate && options.folderName) {
      backupFolder = path.join(backupDir, options.folderName);
    } else {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      backupFolder = path.join(backupDir, `jwellers_edith_backup_${dateStr}`);
    }

    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    const backupPath = path.join(backupFolder, backupFileName);

    // Save actual SQLite db file for system recovery
    db.backup(backupPath);

    const stats = fs.statSync(backupPath);
    const fileHash = this.calculateFileHash(backupPath);

    // Helper to escape values for Excel-friendly CSVs
    const toCsvField = (val) => {
      if (val === null || val === undefined) return '""';
      return '"' + String(val).replace(/"/g, '""') + '"';
    };

    // 1. Export Customers spreadsheet
    try {
      const customers = db.prepare(`
        SELECT customer_id, name, phone1, phone2, city, address, aadhaar_number, notes, created_at
        FROM customers WHERE is_deleted = 0
      `).all();
      const custHeaders = ['Customer ID', 'Name', 'Phone 1', 'Phone 2', 'City', 'Address', 'Aadhaar Number', 'Notes', 'Created At'];
      const custRows = customers.map(c => [
        c.customer_id, c.name, c.phone1, c.phone2, c.city, c.address, c.aadhaar_number, c.notes, c.created_at
      ].map(toCsvField).join(','));
      // Write with UTF-8 BOM (\uFEFF) to make Excel parse currency and text correctly
      fs.writeFileSync(path.join(backupFolder, 'Customers.csv'), '\uFEFF' + [custHeaders.join(','), ...custRows].join('\n'), 'utf8');
    } catch (e) {
      console.error('Failed to export customers to CSV', e);
    }

    // 2. Export Inventory Stock spreadsheet
    try {
      const products = db.prepare(`
        SELECT p.id, p.product_name, c.name as category_name, t.name as type_name, p.metal, p.purity,
               p.gross_weight, p.net_weight, p.quantity_in_stock, p.unit, p.purchase_price, p.selling_price, p.description
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_types t ON t.id = p.product_type_id
        WHERE p.is_deleted = 0
      `).all();
      const prodHeaders = ['Product ID', 'Product Name', 'Category', 'Type', 'Metal', 'Purity', 'Gross Weight', 'Net Weight', 'Stock', 'Unit', 'Purchase Price', 'Selling Price', 'Description'];
      const prodRows = products.map(p => [
        p.id, p.product_name, p.category_name, p.type_name, p.metal, p.purity,
        p.gross_weight, p.net_weight, p.quantity_in_stock, p.unit, p.purchase_price, p.selling_price, p.description
      ].map(toCsvField).join(','));
      fs.writeFileSync(path.join(backupFolder, 'Inventory_Stock.csv'), '\uFEFF' + [prodHeaders.join(','), ...prodRows].join('\n'), 'utf8');
    } catch (e) {
      console.error('Failed to export products to CSV', e);
    }

    // 3. Export Bills History spreadsheet
    try {
      const bills = db.prepare(`
        SELECT b.invoice_number, b.bill_date, c.name as customer_name, b.bill_type, b.subtotal,
               b.making_charge_total, b.discount_amount, b.taxable_amount, b.tax_total, b.round_off,
               b.grand_total, b.paid_amount, b.balance_amount, b.payment_status
        FROM bills b
        LEFT JOIN customers c ON c.id = b.customer_id
      `).all();
      const billHeaders = ['Invoice Number', 'Bill Date', 'Customer Name', 'Bill Type', 'Subtotal', 'Making Charge Total', 'Discount Amount', 'Taxable Amount', 'Tax Total', 'Round Off', 'Grand Total', 'Paid Amount', 'Balance Amount', 'Payment Status'];
      const billRows = bills.map(b => [
        b.invoice_number, b.bill_date, b.customer_name, b.bill_type, b.subtotal,
        b.making_charge_total, b.discount_amount, b.taxable_amount, b.tax_total, b.round_off,
        b.grand_total, b.paid_amount, b.balance_amount, b.payment_status
      ].map(toCsvField).join(','));
      fs.writeFileSync(path.join(backupFolder, 'Bills_History.csv'), '\uFEFF' + [billHeaders.join(','), ...billRows].join('\n'), 'utf8');
    } catch (e) {
      console.error('Failed to export bills to CSV', e);
    }

    // 4. Export Ledger (Khata) spreadsheet
    try {
      const txns = db.prepare(`
        SELECT c.name as customer_name, kt.transaction_date, kt.transaction_type,
               kt.debit, kt.credit, kt.balance,
               p.payment_method, kt.notes
        FROM khata_transactions kt
        LEFT JOIN customers c ON c.id = kt.customer_id AND c.is_deleted = 0
        LEFT JOIN payments p ON p.id = kt.payment_id
        ORDER BY c.name, kt.transaction_date ASC
      `).all();
      const ledgerHeaders = ['Customer Name', 'Transaction Date', 'Type', 'Debit (Owed)', 'Credit (Paid)', 'Balance', 'Method', 'Notes'];
      const ledgerRows = txns.map(t => [
        t.customer_name, t.transaction_date, t.transaction_type, t.debit, t.credit, t.balance, t.payment_method, t.notes
      ].map(toCsvField).join(','));
      fs.writeFileSync(path.join(backupFolder, 'Khata_Ledger.csv'), '\uFEFF' + [ledgerHeaders.join(','), ...ledgerRows].join('\n'), 'utf8');

    } catch (e) {
      console.error('Failed to export ledger to CSV', e);
    }

    // 5. Export Girvi (Pledge) Loans — active only (is_deleted = 0)
    try {
      const loans = db.prepare(`
        SELECT
          g.loan_number, g.loan_date, g.customer_name, g.father_husband_name, g.caste,
          g.phone1, g.address, g.item_name, g.metal_type,
          g.gold_weight, g.silver_weight, g.principal_amount,
          g.monthly_interest_percent, g.interest_type, g.locker_number,
          g.reference_person, g.status, g.notes, g.created_at, g.updated_at
        FROM girvi_loans g
        WHERE g.is_deleted = 0
        ORDER BY g.loan_date DESC
      `).all();
      const loanHeaders = [
        'Girvi No.', 'Pledge Date', 'Customer Name', 'Father/Husband Name', 'Caste (जाति)',
        'Mobile', 'Address (पता)', 'Ornament (आभूषण)', 'Metal Type',
        'Gold Weight (gm)', 'Silver Weight (gm)', 'Principal Amount (₹)',
        'Monthly Rate (%)', 'Interest Type', 'Locker No.',
        'Reference Person', 'Status', 'Notes', 'Created At', 'Updated At'
      ];
      const loanRows = loans.map(l => [
        l.loan_number, l.loan_date, l.customer_name, l.father_husband_name, l.caste,
        l.phone1, l.address, l.item_name, l.metal_type,
        l.gold_weight, l.silver_weight, l.principal_amount,
        l.monthly_interest_percent, l.interest_type, l.locker_number,
        l.reference_person, l.status, l.notes, l.created_at, l.updated_at
      ].map(toCsvField).join(','));
      fs.writeFileSync(path.join(backupFolder, 'Girvi_Loans.csv'), '\uFEFF' + [loanHeaders.join(','), ...loanRows].join('\n'), 'utf8');
    } catch (e) {
      console.error('Failed to export girvi loans to CSV', e);
    }

    // 5. Write user-friendly README instruction sheet
    try {
      const readmeContent = `JWELLERS EDITH DATABASE BACKUP
==============================
Created at: ${new Date().toLocaleString('en-IN')}

This folder contains a complete backup of your jewellery shop data.

FILES IN THIS FOLDER:
1. jwellers_edith_database.db  <- DO NOT EDIT OR DELETE. This file is required by the software to Restore your data.
2. Customers.csv               <- Open in Microsoft Excel to view or print your customer list.
3. Inventory_Stock.csv         <- Open in Microsoft Excel to view your current stock levels and prices.
4. Bills_History.csv           <- Open in Microsoft Excel to view your sales and invoice history.
5. Khata_Ledger.csv            <- Open in Microsoft Excel to view customer accounts ledger.

HOW TO RESTORE:
To restore this backup, open Jwellers Edith, navigate to the "Backup & Restore" screen, select this backup row, and click "Restore Selected".
`;
      fs.writeFileSync(path.join(backupFolder, 'README.txt'), readmeContent, 'utf8');
    } catch (e) {
      console.error('Failed to write README.txt', e);
    }

    const result = {
      path: backupPath,
      fileName: path.join(path.basename(backupFolder), backupFileName),
      fileSize: stats.size,
      fileHash,
      createdAt: new Date().toISOString()
    };

    this.recordBackupHistory(options, result);

    return result;
  }

  calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  recordBackupHistory(options, backupResult) {
    const db = getDb();
    const backupType = options.backupType || 'local';

    const appSettings = db.prepare('SELECT app_version, schema_version FROM app_settings WHERE id = 1').get();

    if (options.isUpdate) {
      db.prepare(`
        UPDATE backup_history
        SET file_size = ?, file_hash = ?, created_at = datetime('now', 'localtime')
        WHERE backup_location = ?
      `).run(backupResult.fileSize, backupResult.fileHash, backupResult.path);
    } else {
      db.prepare(`
        INSERT INTO backup_history (backup_type, backup_location, file_size, file_hash, schema_version, app_version, status, verification_status, user_id)
        VALUES (?, ?, ?, ?, ?, ?, 'completed', 'verified', ?)
      `).run(
        backupType,
        backupResult.path,
        backupResult.fileSize,
        backupResult.fileHash,
        appSettings ? appSettings.schema_version : 0,
        appSettings ? appSettings.app_version : null,
        options.userId || null
      );
    }

    db.prepare(`UPDATE app_settings SET last_backup_at = datetime('now', 'localtime') WHERE id = 1`).run();
  }

  verifyBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      return { valid: false, error: 'Backup file not found' };
    }

    try {
      const backupDb = new Database(backupPath);
      const data = fs.readFileSync(backupPath);
      const sqlJs = require('sql.js');
      const initSqlJs = sqlJs.default || sqlJs;
      const fileHash = this.calculateFileHash(backupPath);
      return { valid: true, fileHash, fileSize: fs.statSync(backupPath).size };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  restoreBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found: ' + backupPath);
    }

    const verification = this.verifyBackup(backupPath);
    if (!verification.valid) {
      throw new Error('Backup verification failed: ' + verification.error);
    }

    const currentPath = getPath();

    close();

    try {
      fs.copyFileSync(backupPath, currentPath);
      return { success: true, path: currentPath };
    } catch (error) {
      throw new Error('Restore failed: ' + error.message);
    }
  }

  listBackups(options = {}) {
    const db = getDb();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    let sql = 'SELECT * FROM backup_history ORDER BY created_at DESC LIMIT ? OFFSET ?';
    if (options.backupType) {
      sql = 'SELECT * FROM backup_history WHERE backup_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      return db.prepare(sql).all(options.backupType, limit, offset);
    }

    return db.prepare(sql).all(limit, offset);
  }
}

module.exports = BackupManager;
