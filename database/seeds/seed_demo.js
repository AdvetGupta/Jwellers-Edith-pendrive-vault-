const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const connection = require('../connection');
const { initialize } = require('../init');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function seed(customDb) {
  let db = customDb;
  if (!db) {
    if (connection.isOpen()) {
      db = connection.getDb();
    } else {
      const dbPath = path.join(__dirname, '..', '..', 'demo_jwellers_edith.db');
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      db = await initialize(dbPath);
    }
  }

  // Check if users already seeded
  const userCount = db.prepare('SELECT count(*) as count FROM users').get()?.count || 0;
  if (userCount > 0) {
    console.log('Database already has users, skipping seed.');
    return db;
  }

  console.log('Seeding demo data...');

  // --- USERS ---
  const ownerRoleId = 1;
  const staffRoleId = 2;

  db.prepare(`INSERT INTO users (username, password_hash, display_name, role_id, phone, is_active)
    VALUES ('owner', ?, 'Owner', ?, '9876543210', 1)`)
    .run(hashPassword('owner123'), ownerRoleId);

  db.prepare(`INSERT INTO users (username, password_hash, display_name, role_id, phone, is_active)
    VALUES ('staff', ?, 'Staff Member', ?, '9876543211', 1)`)
    .run(hashPassword('staff123'), staffRoleId);

  // --- SHOP SETTINGS ---
  db.prepare(`
    UPDATE shop_settings SET
      shop_name = 'Shree Jewellers',
      owner_name = 'Rajesh Kumar',
      address = '42, MG Road, Near Clock Tower',
      city = 'Mumbai',
      phone = '9876543210',
      whatsapp_number = '9876543210',
      gst_number = '27ABCDE1234F1Z5',
      pan_number = 'ABCDE1234F',
      invoice_prefix = 'INV-',
      invoice_next_number = 1001,
      default_gst_rate = 3.0
    WHERE id = 1
  `).run();

  // --- MEMBERSHIP LEVELS ---
  const membershipData = [
    { name: 'Regular', discount: 0, sort: 1, isDefault: 1 },
    { name: 'Silver', discount: 2, sort: 2, isDefault: 0 },
    { name: 'Gold', discount: 5, sort: 3, isDefault: 0 },
    { name: 'Platinum', discount: 8, sort: 4, isDefault: 0 },
    { name: 'VIP', discount: 10, sort: 5, isDefault: 0 }
  ];

  const insertMembership = db.prepare(`
    INSERT INTO membership_levels (name, discount_percentage, sort_order, is_default)
    VALUES (?, ?, ?, ?)
  `);
  for (const m of membershipData) {
    insertMembership.run(m.name, m.discount, m.sort, m.isDefault);
  }

  // --- CATEGORIES ---
  const categoryData = ['Gold', 'Silver', 'Diamond', 'Platinum'];
  const insertCategory = db.prepare(`INSERT INTO categories (name, is_default, sort_order) VALUES (?, 1, ?)`);
  categoryData.forEach((c, i) => insertCategory.run(c, i + 1));

  // --- PRODUCT TYPES ---
  const productTypeData = [
    'Ring', 'Chain', 'Necklace', 'Bangle', 'Bracelet',
    'Earrings', 'Pendant', 'Mangalsutra', 'Nose Pin', 'Anklet', 'Others'
  ];
  const insertProductType = db.prepare(`INSERT INTO product_types (name, sort_order) VALUES (?, ?)`);
  productTypeData.forEach((pt, i) => insertProductType.run(pt, i + 1));

  // --- SUPPLIERS ---
  const supplierData = [
    { id: 'SUP-001', name: 'Mumbai Gold Traders', phone: '9988776655', city: 'Mumbai' },
    { id: 'SUP-002', name: 'Rajkot Diamond House', phone: '8877665544', city: 'Rajkot' },
    { id: 'SUP-003', name: 'Delhi Silver Emporium', phone: '7766554433', city: 'Delhi' },
    { id: 'SUP-004', name: 'Jaipur Gem Studio', phone: '6655443322', city: 'Jaipur' },
    { id: 'SUP-005', name: 'Chennai Platinum Hub', phone: '5544332211', city: 'Chennai' }
  ];
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (supplier_id, name, phone, city) VALUES (?, ?, ?, ?)
  `);
  for (const s of supplierData) {
    insertSupplier.run(s.id, s.name, s.phone, s.city);
  }

  // --- PRODUCTS ---
  const productData = [
    { name: '22K Gold Ring', cat: 1, type: 1, metal: 'Gold', purity: '22K', gross: 8.5, net: 7.8, making: 450, selling: 38500, qty: 15, hsn: '71131913' },
    { name: '24K Gold Chain', cat: 1, type: 2, metal: 'Gold', purity: '24K', gross: 25.0, net: 23.5, making: 1200, selling: 125000, qty: 8, hsn: '71131913' },
    { name: 'Gold Mangalsutra', cat: 1, type: 8, metal: 'Gold', purity: '22K', gross: 12.0, net: 11.0, making: 800, selling: 55000, qty: 10, hsn: '71131913' },
    { name: 'Silver Bangle Set', cat: 2, type: 4, metal: 'Silver', purity: '92.5%', gross: 60.0, net: 55.0, making: 300, selling: 4500, qty: 20, hsn: '71131130' },
    { name: 'Diamond Ring', cat: 3, type: 1, metal: 'Gold', purity: '18K', gross: 5.2, net: 3.8, making: 2500, selling: 95000, qty: 5, hsn: '71131913' },
    { name: 'Diamond Necklace', cat: 3, type: 3, metal: 'Gold', purity: '18K', gross: 18.5, net: 12.0, making: 5000, selling: 285000, qty: 3, hsn: '71131913' },
    { name: 'Platinum Band', cat: 4, type: 1, metal: 'Platinum', purity: '950', gross: 8.0, net: 7.2, making: 3000, selling: 72000, qty: 6, hsn: '71131913' },
    { name: 'Gold Earrings', cat: 1, type: 6, metal: 'Gold', purity: '22K', gross: 6.0, net: 5.2, making: 350, selling: 28000, qty: 25, hsn: '71131913' },
    { name: 'Silver Anklet', cat: 2, type: 10, metal: 'Silver', purity: '92.5%', gross: 40.0, net: 36.0, making: 200, selling: 3200, qty: 12, hsn: '71131130' },
    { name: 'Gold Bracelet', cat: 1, type: 5, metal: 'Gold', purity: '22K', gross: 15.0, net: 13.8, making: 600, selling: 68000, qty: 7, hsn: '71131913' },
    { name: 'Silver Pendant', cat: 2, type: 7, metal: 'Silver', purity: '92.5%', gross: 10.0, net: 8.5, making: 150, selling: 1800, qty: 30, hsn: '71131130' },
    { name: 'Diamond Pendant', cat: 3, type: 7, metal: 'Gold', purity: '18K', gross: 4.0, net: 2.5, making: 1800, selling: 65000, qty: 4, hsn: '71131913' }
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (product_name, category_id, product_type_id, metal, purity,
      gross_weight, net_weight, making_charge, selling_price,
      quantity_in_stock, hsn_code, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const productIds = [];
  for (const p of productData) {
    insertProduct.run(
      p.name, p.cat, p.type, p.metal, p.purity,
      p.gross, p.net, p.making, p.selling,
      p.qty, p.hsn
    );
    productIds.push(db.lastInsertRowid);
  }

  // --- INVENTORY OPENING MOVEMENTS ---
  const insertInvMovement = db.prepare(`
    INSERT INTO inventory_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, user_id, notes)
    VALUES (?, 'opening_stock', 0, ?, ?, 1, 'Opening stock')
  `);
  for (let i = 0; i < productData.length; i++) {
    insertInvMovement.run(productIds[i], productData[i].qty, productData[i].qty);
  }

  // --- CUSTOMERS ---
  const customerData = [
    { id: 'CUST-0001', name: 'Amit Sharma', phone1: '9812345678', city: 'Mumbai', membership: 3 },
    { id: 'CUST-0002', name: 'Priya Patel', phone1: '9823456789', city: 'Mumbai', membership: 4 },
    { id: 'CUST-0003', name: 'Ravi Verma', phone1: '9834567890', city: 'Delhi', membership: 2 },
    { id: 'CUST-0004', name: 'Sunita Gupta', phone1: '9845678901', city: 'Mumbai', membership: 1 },
    { id: 'CUST-0005', name: 'Vikram Singh', phone1: '9856789012', city: 'Pune', membership: 5 },
    { id: 'CUST-0006', name: 'Anita Desai', phone1: '9867890123', city: 'Mumbai', membership: 1 },
    { id: 'CUST-0007', name: 'Rajesh Joshi', phone1: '9878901234', city: 'Ahmedabad', membership: 2 },
    { id: 'CUST-0008', name: 'Kavita Reddy', phone1: '9889012345', city: 'Hyderabad', membership: 3 },
    { id: 'CUST-0009', name: 'Deepak Nair', phone1: '9890123456', city: 'Mumbai', membership: 1 },
    { id: 'CUST-0010', name: 'Meera Iyer', phone1: '9901234567', city: 'Chennai', membership: 4 },
    { id: 'CUST-0011', name: 'Suresh Yadav', phone1: '9912345678', city: 'Delhi', membership: 1 },
    { id: 'CUST-0012', name: 'Pooja Mehta', phone1: '9923456789', city: 'Mumbai', membership: 2 },
    { id: 'CUST-0013', name: 'Arun Kumar', phone1: '9934567890', city: 'Bangalore', membership: 1 },
    { id: 'CUST-0014', name: 'Neha Jain', phone1: '9945678901', city: 'Mumbai', membership: 3 },
    { id: 'CUST-0015', name: 'Manoj Tiwari', phone1: '9956789012', city: 'Lucknow', membership: 1 },
    { id: 'CUST-0016', name: 'Ritu Agarwal', phone1: '9967890123', city: 'Mumbai', membership: 5 },
    { id: 'CUST-0017', name: 'Karan Kapoor', phone1: '9978901234', city: 'Chandigarh', membership: 1 },
    { id: 'CUST-0018', name: 'Shweta Mishra', phone1: '9989012345', city: 'Mumbai', membership: 2 },
    { id: 'CUST-0019', name: 'Gaurav Bhatia', phone1: '9990123456', city: 'Mumbai', membership: 1 },
    { id: 'CUST-0020', name: 'Lata Krishnan', phone1: '9911223344', city: 'Mumbai', membership: 3 },
    { id: 'CUST-0021', name: 'Nitin Choudhury', phone1: '9922334455', city: 'Kolkata', membership: 1 },
    { id: 'CUST-0022', name: 'Divya Saxena', phone1: '9933445566', city: 'Mumbai', membership: 4 },
    { id: 'CUST-0023', name: 'Rohan Deshmukh', phone1: '9944556677', city: 'Pune', membership: 2 },
    { id: 'CUST-0024', name: 'Anjali Kulkarni', phone1: '9955667788', city: 'Mumbai', membership: 1 },
    { id: 'CUST-0025', name: 'Siddharth Rao', phone1: '9966778899', city: 'Bangalore', membership: 5 },
    { id: 'CUST-0026', name: 'MIG-CUST-001', phone1: '9977889900', city: 'Mumbai', membership: 1, source: 'migrated', originalDate: '2025-06-15' },
    { id: 'CUST-0027', name: 'MIG-CUST-002', phone1: '9988990011', city: 'Delhi', membership: 2, source: 'migrated', originalDate: '2025-08-20' },
    { id: 'CUST-0028', name: 'MIG-CUST-003', phone1: '9999001122', city: 'Mumbai', membership: 3, source: 'migrated', originalDate: '2025-10-10' },
    { id: 'CUST-0029', name: 'MIG-CUST-004', phone1: '9911002233', city: 'Surat', membership: 1, source: 'migrated', originalDate: '2025-12-01' },
    { id: 'CUST-0030', name: 'MIG-CUST-005', phone1: '9922003344', city: 'Mumbai', membership: 4, source: 'migrated', originalDate: '2026-01-05' }
  ];

  const insertCustomer = db.prepare(`
    INSERT INTO customers (customer_id, name, phone1, city, membership_level_id, data_source, original_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of customerData) {
    insertCustomer.run(c.id, c.name, c.phone1, c.city, c.membership, c.source || 'live', c.originalDate || null);
  }

  const allCustomers = db.prepare('SELECT id FROM customers ORDER BY id').all();
  const custIds = allCustomers.map(c => c.id);

  // --- BILLS ---
  const billData = [
    { inv: 'INV-2026-0001', type: 'gst', customer: custIds[0], user: 1, date: '2026-06-01', subtotal: 38500, cgst: 1.5, sgst: 1.5, taxTotal: 1155, grandTotal: 39655, paid: 39655, status: 'paid' },
    { inv: 'INV-2026-0002', type: 'gst', customer: custIds[1], user: 1, date: '2026-06-03', subtotal: 125000, cgst: 1.5, sgst: 1.5, taxTotal: 3750, grandTotal: 128750, paid: 128750, status: 'paid' },
    { inv: 'INV-2026-0003', type: 'non_gst', customer: custIds[2], user: 2, date: '2026-06-05', subtotal: 28000, taxTotal: 0, grandTotal: 28000, paid: 15000, status: 'partial' },
    { inv: 'INV-2026-0004', type: 'gst', customer: custIds[3], user: 1, date: '2026-06-08', subtotal: 55000, cgst: 1.5, sgst: 1.5, taxTotal: 1650, grandTotal: 56650, paid: 0, status: 'unpaid' },
    { inv: 'INV-2026-0005', type: 'non_gst', customer: custIds[4], user: 1, date: '2026-06-10', subtotal: 4500, taxTotal: 0, grandTotal: 4500, paid: 4500, status: 'paid' },
    { inv: 'INV-2026-0006', type: 'gst', customer: custIds[5], user: 2, date: '2026-06-12', subtotal: 72000, cgst: 1.5, sgst: 1.5, taxTotal: 2160, grandTotal: 74160, paid: 74160, status: 'paid' },
    { inv: 'INV-2026-0007', type: 'gst', customer: custIds[6], user: 1, date: '2026-06-15', subtotal: 95000, cgst: 1.5, sgst: 1.5, taxTotal: 2850, grandTotal: 97850, paid: 50000, status: 'partial' },
    { inv: 'INV-2026-0008', type: 'non_gst', customer: custIds[7], user: 1, date: '2026-06-18', subtotal: 3200, taxTotal: 0, grandTotal: 3200, paid: 3200, status: 'paid' },
    { inv: 'INV-2026-0009', type: 'gst', customer: custIds[8], user: 2, date: '2026-06-20', subtotal: 68000, cgst: 1.5, sgst: 1.5, taxTotal: 2040, grandTotal: 70040, paid: 0, status: 'unpaid' },
    { inv: 'INV-2026-0010', type: 'non_gst', customer: custIds[9], user: 1, date: '2026-06-22', subtotal: 1800, taxTotal: 0, grandTotal: 1800, paid: 1800, status: 'paid' },
    { inv: 'INV-2026-0011', type: 'gst', customer: custIds[10], user: 1, date: '2026-06-25', subtotal: 125000, cgst: 1.5, sgst: 1.5, taxTotal: 3750, grandTotal: 128750, paid: 100000, status: 'partial' },
    { inv: 'INV-2026-0012', type: 'gst', customer: custIds[11], user: 2, date: '2026-07-01', subtotal: 285000, cgst: 1.5, sgst: 1.5, taxTotal: 8550, grandTotal: 293550, paid: 0, status: 'unpaid' }
  ];

  const insertBill = db.prepare(`
    INSERT INTO bills (invoice_number, bill_type, customer_id, user_id, bill_date,
      subtotal, cgst_rate, sgst_rate, tax_total, grand_total, paid_amount, balance_amount, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBillItem = db.prepare(`
    INSERT INTO bill_items (bill_id, item_type, product_id, description, category_id, hsn_code,
      metal, purity, gross_weight, net_weight, making_charge, rate, quantity, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (customer_id, user_id, payment_date, amount, payment_method, type)
    VALUES (?, ?, ?, ?, ?, 'bill_payment')
  `);

  const insertPaymentAllocation = db.prepare(`
    INSERT INTO payment_allocations (payment_id, bill_id, amount) VALUES (?, ?, ?)
  `);

  const insertKhata = db.prepare(`
    INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, bill_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertActivityLog = db.prepare(`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  let khataBalances = {};
  for (const cid of custIds) { khataBalances[cid] = 0; }

  const billProductMap = [
    { customer: custIds[0], items: [{ productIdx: 0, qty: 1 }], payment: 39655 },
    { customer: custIds[1], items: [{ productIdx: 1, qty: 1 }], payment: 128750 },
    { customer: custIds[2], items: [{ productIdx: 7, qty: 1 }], payment: 15000 },
    { customer: custIds[3], items: [{ productIdx: 2, qty: 1 }], payment: 0 },
    { customer: custIds[4], items: [{ productIdx: 3, qty: 1 }], payment: 4500 },
    { customer: custIds[5], items: [{ productIdx: 6, qty: 1 }], payment: 74160 },
    { customer: custIds[6], items: [{ productIdx: 4, qty: 1 }], payment: 50000 },
    { customer: custIds[7], items: [{ productIdx: 8, qty: 1 }], payment: 3200 },
    { customer: custIds[8], items: [{ productIdx: 9, qty: 1 }], payment: 0 },
    { customer: custIds[9], items: [{ productIdx: 10, qty: 1 }], payment: 1800 },
    { customer: custIds[10], items: [{ productIdx: 1, qty: 1 }], payment: 100000 },
    { customer: custIds[11], items: [{ productIdx: 5, qty: 1 }], payment: 0 }
  ];

  for (let i = 0; i < billData.length; i++) {
    const b = billData[i];
    const bp = billProductMap[i];
    const balanceAmt = b.grandTotal - b.paid;

    insertBill.run(b.inv, b.type, b.customer, b.user, b.date,
      b.subtotal, b.cgst || 0, b.sgst || 0, b.taxTotal,
      b.grandTotal, b.paid, balanceAmt, b.status);

    const billId = db.lastInsertRowid;

    for (const item of bp.items) {
      const prod = productData[item.productIdx];
      const prodId = productIds[item.productIdx];
      insertBillItem.run(billId, 'inventory', prodId, prod.name, prod.cat, prod.hsn,
        prod.metal, prod.purity, prod.gross, prod.net, prod.making,
        prod.selling, item.qty, prod.selling * item.qty);
    }

    if (i % 3 === 0) {
      insertBillItem.run(billId, 'manual', null, 'Repair Charge', null, null,
        null, null, null, null, 0, 500, 1, 500);
    }

    if (b.paid > 0) {
      insertPayment.run(b.customer, b.user, b.date, b.paid, 'cash');
      const paymentId = db.lastInsertRowid;
      insertPaymentAllocation.run(paymentId, billId, b.paid);

      khataBalances[b.customer] -= b.paid;
      insertKhata.run(b.customer, b.date, 'payment', 0, b.paid, khataBalances[b.customer], null, b.user);
    }

    khataBalances[b.customer] += b.grandTotal;
    insertKhata.run(b.customer, b.date, 'bill', b.grandTotal, 0, khataBalances[b.customer], billId, b.user);

    if (b.type === 'gst') {
      for (const item of bp.items) {
        const prod = productData[item.productIdx];
        const prodId = productIds[item.productIdx];
        const beforeQty = prod.qty;
        prod.qty -= item.qty;
        db.prepare(`
          INSERT INTO inventory_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, bill_id, user_id, notes)
          VALUES (?, 'sold', ?, ?, ?, ?, ?, 'Bill sale')
        `).run(prodId, beforeQty, -item.qty, prod.qty, billId, b.user);
      }
    }

    insertActivityLog.run(b.user, 'bill_created', 'bill', billId, `Created bill ${b.inv} for ₹${b.grandTotal}`);
  }

  // --- OPENING KHATA BALANCES FOR MIGRATED CUSTOMERS ---
  const migratedCustomers = db.prepare("SELECT id FROM customers WHERE data_source = 'migrated'").all();
  const openingBalances = [15000, 25000, 8000, 42000, 12000];
  for (let i = 0; i < migratedCustomers.length; i++) {
    const cid = migratedCustomers[i].id;
    const balance = openingBalances[i] || 10000;
    db.prepare(`
      INSERT INTO khata_transactions (customer_id, transaction_date, transaction_type, debit, credit, balance, notes, user_id, data_source)
      VALUES (?, '2025-12-31', 'opening_balance', ?, 0, ?, 'Opening balance from previous system', 1, 'migrated')
    `).run(cid, balance, balance);
  }

  // --- COMMUNICATION LOGS ---
  const commLogs = [
    { customer: custIds[0], type: 'whatsapp', msgType: 'invoice', bill: 1, number: '9812345678', status: 'sent' },
    { customer: custIds[1], type: 'whatsapp', msgType: 'payment_confirmation', bill: 2, number: '9823456789', status: 'sent' },
    { customer: custIds[4], type: 'whatsapp', msgType: 'invoice', bill: 5, number: '9856789012', status: 'sent' },
    { customer: custIds[2], type: 'sms', msgType: 'khata_reminder', bill: 3, number: '9834567890', status: 'sent' },
    { customer: custIds[9], type: 'whatsapp', msgType: 'payment_confirmation', bill: 10, number: '9901234567', status: 'failed' }
  ];

  const insertCommLog = db.prepare(`
    INSERT INTO communication_logs (customer_id, communication_type, message_type, bill_id, recipient_number, status, sent_at, user_id)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), 1)
  `);
  for (const c of commLogs) {
    insertCommLog.run(c.customer, c.type, c.msgType, c.bill, c.number, c.status);
  }

  // --- BACKUP HISTORY ---
  db.prepare(`
    INSERT INTO backup_history (backup_type, backup_location, file_size, file_hash, schema_version, status, verification_status, user_id)
    VALUES ('local', 'D:\\Backups\\jwellers_backup_2026-06-25.db', 524288, 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', 1, 'completed', 'verified', 1)
  `).run();

  // --- PERMISSIONS ---
  const permissionData = [
    { code: 'dashboard.view', name: 'View Dashboard', module: 'Dashboard' },
    { code: 'customer.create', name: 'Create Customer', module: 'Customers' },
    { code: 'customer.edit', name: 'Edit Customer', module: 'Customers' },
    { code: 'customer.view', name: 'View Customer', module: 'Customers' },
    { code: 'customer.delete', name: 'Delete Customer', module: 'Customers' },
    { code: 'product.create', name: 'Create Product', module: 'Products' },
    { code: 'product.edit', name: 'Edit Product', module: 'Products' },
    { code: 'product.view', name: 'View Product', module: 'Products' },
    { code: 'product.delete', name: 'Delete Product', module: 'Products' },
    { code: 'inventory.view', name: 'View Inventory', module: 'Inventory' },
    { code: 'inventory.adjust', name: 'Adjust Inventory', module: 'Inventory' },
    { code: 'bill.create', name: 'Create Bill', module: 'Billing' },
    { code: 'bill.view', name: 'View Bill', module: 'Billing' },
    { code: 'bill.cancel', name: 'Cancel Bill', module: 'Billing' },
    { code: 'payment.create', name: 'Record Payment', module: 'Payments' },
    { code: 'payment.view', name: 'View Payments', module: 'Payments' },
    { code: 'khata.view', name: 'View Khata', module: 'Khata' },
    { code: 'khata.adjust', name: 'Adjust Khata', module: 'Khata' },
    { code: 'report.view', name: 'View Reports', module: 'Reports' },
    { code: 'staff.create', name: 'Create Staff', module: 'Staff' },
    { code: 'staff.edit', name: 'Edit Staff', module: 'Staff' },
    { code: 'staff.delete', name: 'Delete Staff', module: 'Staff' },
    { code: 'settings.view', name: 'View Settings', module: 'Settings' },
    { code: 'settings.edit', name: 'Edit Settings', module: 'Settings' },
    { code: 'backup.create', name: 'Create Backup', module: 'Backup' },
    { code: 'backup.restore', name: 'Restore Backup', module: 'Backup' },
    { code: 'activity.view', name: 'View Activity Logs', module: 'Activity' },
    { code: 'communication.send', name: 'Send Communication', module: 'Communication' }
  ];

  const insertPermission = db.prepare(`INSERT INTO permissions (code, name, module) VALUES (?, ?, ?)`);
  for (const p of permissionData) {
    insertPermission.run(p.code, p.name, p.module);
  }

  const allPermIds = db.prepare('SELECT id FROM permissions').all();
  const insertRolePerm = db.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
  for (const p of allPermIds) {
    insertRolePerm.run(ownerRoleId, p.id);
  }

  const staffPermCodes = [
    'dashboard.view',
    'customer.create', 'customer.edit', 'customer.view',
    'product.create', 'product.edit', 'product.view',
    'inventory.view', 'inventory.adjust',
    'bill.create', 'bill.view', 'bill.cancel',
    'payment.create', 'payment.view',
    'khata.view', 'khata.adjust',
    'report.view', 'settings.view',
    'communication.send'
  ];
  const staffPerms = db.prepare(`SELECT id FROM permissions WHERE code IN (${staffPermCodes.map(() => '?').join(',')})`).all(...staffPermCodes);
  for (const p of staffPerms) {
    insertRolePerm.run(staffRoleId, p.id);
  }

  insertActivityLog.run(1, 'system_setup', 'system', null, 'Demo database seeded successfully');

  console.log('\nDemo data seeding complete!');
  console.log('Database: ' + dbPath);
  console.log('Owner login: owner / owner123');
  console.log('Staff login: staff / staff123');

  connection.close();
  return dbPath;
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { seed };
