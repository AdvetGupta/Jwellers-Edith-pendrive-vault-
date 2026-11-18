-- =============================================================
-- JWELLERS EDITH — Complete Database Schema
-- Version: 1
-- Author: AD's Creation
-- Description: Production schema for jewellery shop management
-- =============================================================

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

-- =============================================================
-- 1. USERS & AUTHENTICATION
-- =============================================================

CREATE TABLE IF NOT EXISTS roles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    description     TEXT,
    is_system       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS permissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT    NOT NULL UNIQUE,
    name            TEXT    NOT NULL,
    description     TEXT,
    module          TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id   INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    is_granted      INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    display_name    TEXT    NOT NULL,
    role_id         INTEGER NOT NULL REFERENCES roles(id),
    phone           TEXT,
    email           TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    last_login_at   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- =============================================================
-- 2. SHOP & APPLICATION SETTINGS
-- =============================================================

CREATE TABLE IF NOT EXISTS shop_settings (
    id                          INTEGER PRIMARY KEY CHECK (id = 1),
    shop_name                   TEXT,
    owner_name                  TEXT,
    address                     TEXT,
    city                        TEXT,
    phone                       TEXT,
    whatsapp_number             TEXT,
    gst_number                  TEXT,
    pan_number                  TEXT,
    hallmark_registration       TEXT,
    currency                    TEXT    NOT NULL DEFAULT '₹',
    date_format                 TEXT    NOT NULL DEFAULT 'DD/MM/YYYY',
    invoice_prefix              TEXT    NOT NULL DEFAULT 'INV-',
    invoice_next_number         INTEGER NOT NULL DEFAULT 1,
    invoice_year_format         TEXT    NOT NULL DEFAULT 'YYYY',
    default_gst_rate            REAL    DEFAULT 3.0,
    enable_inventory            INTEGER NOT NULL DEFAULT 1,
    backup_auto_enabled         INTEGER NOT NULL DEFAULT 0,
    backup_auto_interval_days   INTEGER DEFAULT 7,
    backup_auto_folder          TEXT,
    created_at                  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at                  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS app_settings (
    id                          INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version              INTEGER NOT NULL DEFAULT 1,
    app_version                 TEXT,
    db_created_at               TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    last_backup_at              TEXT,
    google_drive_backup_enabled INTEGER NOT NULL DEFAULT 0,
    google_drive_token_enc      TEXT,
    theme                       TEXT    NOT NULL DEFAULT 'light',
    language                    TEXT    NOT NULL DEFAULT 'en'
);

-- =============================================================
-- 3. MEMBERSHIP LEVELS
-- =============================================================

CREATE TABLE IF NOT EXISTS membership_levels (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL UNIQUE,
    discount_percentage REAL    DEFAULT 0,
    description         TEXT,
    sort_order          INTEGER DEFAULT 0,
    is_default          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- =============================================================
-- 4. CATEGORIES & PRODUCT TYPES
-- =============================================================

CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    description TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS product_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- =============================================================
-- 5. SUPPLIERS
-- =============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id         TEXT    UNIQUE,
    name                TEXT    NOT NULL,
    phone               TEXT,
    address             TEXT,
    city                TEXT,
    notes               TEXT,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    data_source         TEXT    NOT NULL DEFAULT 'live'
                            CHECK (data_source IN ('live', 'migrated')),
    migration_batch_id  INTEGER,
    original_date       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_suppliers_city ON suppliers(city);
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted ON suppliers(is_deleted);

-- =============================================================
-- 6. PRODUCTS / INVENTORY
-- =============================================================

CREATE TABLE IF NOT EXISTS products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name        TEXT    NOT NULL,
    category_id         INTEGER REFERENCES categories(id),
    product_type_id     INTEGER REFERENCES product_types(id),
    metal               TEXT,
    purity              TEXT,
    gross_weight        REAL,
    net_weight          REAL,
    stone_weight        REAL,
    stone_type          TEXT,
    making_charge       REAL,
    wastage_percentage  REAL,
    purchase_price      REAL,
    selling_price       REAL,
    supplier_id         INTEGER REFERENCES suppliers(id),
    quantity_in_stock   REAL    NOT NULL DEFAULT 0,
    unit                TEXT    NOT NULL DEFAULT 'gms',
    description         TEXT,
    hallmark_details    TEXT,
    hsn_code            TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    data_source         TEXT    NOT NULL DEFAULT 'live'
                            CHECK (data_source IN ('live', 'migrated')),
    migration_batch_id  INTEGER,
    original_date       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);

-- =============================================================
-- 7. INVENTORY MOVEMENTS
-- =============================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id          INTEGER NOT NULL REFERENCES products(id),
    movement_type       TEXT    NOT NULL
                            CHECK (movement_type IN (
                                'opening_stock', 'purchase_added', 'sold',
                                'returned', 'repair', 'exchange',
                                'damaged', 'lost', 'manual_adjustment'
                            )),
    quantity_before     REAL    NOT NULL,
    quantity_change     REAL    NOT NULL,
    quantity_after      REAL    NOT NULL,
    bill_id             INTEGER REFERENCES bills(id),
    user_id             INTEGER REFERENCES users(id),
    reference           TEXT,
    notes               TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_bill ON inventory_movements(bill_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date ON inventory_movements(created_at);

-- =============================================================
-- 8. CUSTOMERS
-- =============================================================

CREATE TABLE IF NOT EXISTS customers (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id             TEXT    NOT NULL UNIQUE,
    name                    TEXT    NOT NULL,
    relation                TEXT,
    phone1                  TEXT,
    phone2                  TEXT,
    address                 TEXT,
    city                    TEXT,
    aadhaar_number          TEXT,
    notes                   TEXT,
    membership_level_id     INTEGER REFERENCES membership_levels(id),
    is_archived             INTEGER NOT NULL DEFAULT 0,
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    deleted_at              TEXT,
    data_source             TEXT    NOT NULL DEFAULT 'live'
                                CHECK (data_source IN ('live', 'migrated')),
    migration_batch_id      INTEGER,
    original_date           TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_customers_phone1 ON customers(phone1);
CREATE INDEX IF NOT EXISTS idx_customers_phone2 ON customers(phone2);
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_membership ON customers(membership_level_id);
CREATE INDEX IF NOT EXISTS idx_customers_archived ON customers(is_archived);
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(data_source);

-- =============================================================
-- 9. BILLS (GST & Non-GST)
-- =============================================================

CREATE TABLE IF NOT EXISTS bills (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number      TEXT    NOT NULL UNIQUE,
    bill_type           TEXT    NOT NULL
                            CHECK (bill_type IN ('gst', 'non_gst')),
    customer_id         INTEGER NOT NULL REFERENCES customers(id),
    user_id             INTEGER NOT NULL REFERENCES users(id),
    bill_date           TEXT    NOT NULL,
    subtotal            REAL    NOT NULL DEFAULT 0,
    discount_percentage REAL    DEFAULT 0,
    discount_amount     REAL    DEFAULT 0,
    making_charge_total REAL    DEFAULT 0,
    stone_charge_total  REAL    DEFAULT 0,
    wastage_total       REAL    DEFAULT 0,
    taxable_amount      REAL    DEFAULT 0,
    cgst_rate           REAL    DEFAULT 0,
    sgst_rate           REAL    DEFAULT 0,
    igst_rate           REAL    DEFAULT 0,
    cgst_amount         REAL    DEFAULT 0,
    sgst_amount         REAL    DEFAULT 0,
    igst_amount         REAL    DEFAULT 0,
    tax_total           REAL    DEFAULT 0,
    round_off           REAL    DEFAULT 0,
    grand_total         REAL    NOT NULL DEFAULT 0,
    paid_amount         REAL    NOT NULL DEFAULT 0,
    balance_amount      REAL    NOT NULL DEFAULT 0,
    payment_status      TEXT    NOT NULL DEFAULT 'unpaid'
                            CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    notes               TEXT,
    status              TEXT    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'cancelled', 'reversed')),
    cancellation_reason TEXT,
    khata_before        REAL    DEFAULT 0,
    is_migrated         INTEGER NOT NULL DEFAULT 0,
    migration_batch_id  INTEGER,
    original_date       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_type ON bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_invoice ON bills(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_migrated ON bills(is_migrated);

-- =============================================================
-- 10. BILL ITEMS
-- =============================================================

CREATE TABLE IF NOT EXISTS bill_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id             INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    item_type           TEXT    NOT NULL
                            CHECK (item_type IN ('inventory', 'manual')),
    product_id          INTEGER REFERENCES products(id),
    description         TEXT    NOT NULL,
    category_id         INTEGER REFERENCES categories(id),
    hsn_code            TEXT,
    metal               TEXT,
    purity              TEXT,
    gross_weight        REAL,
    net_weight          REAL,
    stone_weight        REAL,
    making_charge       REAL    DEFAULT 0,
    wastage_percentage  REAL    DEFAULT 0,
    wastage_amount      REAL    DEFAULT 0,
    rate                REAL,
    quantity            REAL    NOT NULL DEFAULT 1,
    discount_percentage REAL    DEFAULT 0,
    discount_amount     REAL    DEFAULT 0,
    taxable_amount      REAL    DEFAULT 0,
    cgst_rate           REAL    DEFAULT 0,
    sgst_rate           REAL    DEFAULT 0,
    igst_rate           REAL    DEFAULT 0,
    cgst_amount         REAL    DEFAULT 0,
    sgst_amount         REAL    DEFAULT 0,
    igst_amount         REAL    DEFAULT 0,
    total               REAL    NOT NULL DEFAULT 0,
    sort_order          INTEGER DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_product ON bill_items(product_id);

-- =============================================================
-- 11. PAYMENTS
-- =============================================================

CREATE TABLE IF NOT EXISTS payments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id         INTEGER NOT NULL REFERENCES customers(id),
    user_id             INTEGER NOT NULL REFERENCES users(id),
    payment_date        TEXT    NOT NULL,
    amount              REAL    NOT NULL CHECK (amount > 0),
    payment_method      TEXT    NOT NULL
                            CHECK (payment_method IN ('cash', 'upi', 'card', 'other')),
    reference_number    TEXT,
    notes               TEXT,
    type                TEXT    NOT NULL DEFAULT 'bill_payment'
                            CHECK (type IN (
                                'bill_payment', 'khata_payment',
                                'opening_balance', 'refund', 'adjustment'
                            )),
    data_source         TEXT    NOT NULL DEFAULT 'live'
                            CHECK (data_source IN ('live', 'migrated')),
    migration_batch_id  INTEGER,
    original_date       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);

-- =============================================================
-- 12. PAYMENT ALLOCATIONS (linking payments to specific bills)
-- =============================================================

CREATE TABLE IF NOT EXISTS payment_allocations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id          INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    bill_id             INTEGER REFERENCES bills(id),
    amount              REAL    NOT NULL CHECK (amount > 0),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE(payment_id, bill_id)
);

CREATE INDEX IF NOT EXISTS idx_pay_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_pay_alloc_bill ON payment_allocations(bill_id);

-- =============================================================
-- 13. KHATA / LEDGER TRANSACTIONS
-- =============================================================

CREATE TABLE IF NOT EXISTS khata_transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id         INTEGER NOT NULL REFERENCES customers(id),
    transaction_date    TEXT    NOT NULL,
    transaction_type    TEXT    NOT NULL
                            CHECK (transaction_type IN (
                                'bill', 'payment', 'opening_balance',
                                'adjustment_debit', 'adjustment_credit',
                                'refund', 'deposit'
                            )),
    debit               REAL    NOT NULL DEFAULT 0,
    credit              REAL    NOT NULL DEFAULT 0,
    balance             REAL    NOT NULL,
    bill_id             INTEGER REFERENCES bills(id),
    payment_id          INTEGER REFERENCES payments(id),
    notes               TEXT,
    user_id             INTEGER REFERENCES users(id),
    data_source         TEXT    NOT NULL DEFAULT 'live'
                            CHECK (data_source IN ('live', 'migrated')),
    migration_batch_id  INTEGER,
    original_date       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_khata_customer ON khata_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_khata_date ON khata_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_khata_type ON khata_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_khata_bill ON khata_transactions(bill_id);
CREATE INDEX IF NOT EXISTS idx_khata_payment ON khata_transactions(payment_id);

-- =============================================================
-- 14. COMMUNICATION LOGS
-- =============================================================

CREATE TABLE IF NOT EXISTS communication_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id         INTEGER NOT NULL REFERENCES customers(id),
    communication_type  TEXT    NOT NULL
                            CHECK (communication_type IN ('whatsapp', 'sms')),
    message_type        TEXT    NOT NULL
                            CHECK (message_type IN (
                                'invoice', 'payment_confirmation',
                                'deposit_confirmation', 'khata_reminder', 'girvi_reminder', 'girvi_receipt', 'custom'
                            )),
    bill_id             INTEGER REFERENCES bills(id),
    payment_id          INTEGER REFERENCES payments(id),
    recipient_number    TEXT    NOT NULL,
    message_content     TEXT,
    status              TEXT    NOT NULL
                            CHECK (status IN ('sent', 'failed', 'pending')),
    error_message       TEXT,
    sent_at             TEXT,
    user_id             INTEGER REFERENCES users(id),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_comm_customer ON communication_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_type ON communication_logs(communication_type);
CREATE INDEX IF NOT EXISTS idx_comm_status ON communication_logs(status);
CREATE INDEX IF NOT EXISTS idx_comm_date ON communication_logs(created_at);

-- =============================================================
-- 15. ACTIVITY / AUDIT LOGS
-- =============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER REFERENCES users(id),
    action              TEXT    NOT NULL,
    entity_type         TEXT,
    entity_id           INTEGER,
    description         TEXT,
    metadata            TEXT,
    ip_address          TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_logs(created_at);

-- =============================================================
-- 16. BACKUP HISTORY
-- =============================================================

CREATE TABLE IF NOT EXISTS backup_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_type         TEXT    NOT NULL
                            CHECK (backup_type IN ('local', 'google_drive')),
    backup_location     TEXT    NOT NULL,
    file_size           INTEGER,
    file_hash           TEXT,
    schema_version      INTEGER,
    app_version         TEXT,
    status              TEXT    NOT NULL
                            CHECK (status IN ('completed', 'failed', 'verifying')),
    verification_status TEXT
                            CHECK (verification_status IN ('verified', 'failed', 'not_verified')),
    notes               TEXT,
    user_id             INTEGER REFERENCES users(id),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_backup_type ON backup_history(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_status ON backup_history(status);

-- =============================================================
-- 17. SCHEMA MIGRATIONS & DATA MIGRATION TRACKING
-- =============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    version             INTEGER NOT NULL UNIQUE,
    name                TEXT    NOT NULL,
    sql_checksum        TEXT,
    applied_by          TEXT,
    applied_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    success             INTEGER NOT NULL DEFAULT 1,
    duration_ms         INTEGER
);

CREATE TABLE IF NOT EXISTS migration_batches (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_name          TEXT,
    notes               TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- =============================================================
-- INITIAL SCHEMA VERSION RECORD
-- =============================================================

INSERT OR IGNORE INTO schema_migrations (version, name, applied_by, success)
VALUES (1, 'Initial schema v1', 'system', 1);

-- =============================================================
-- 18. GIRVI (PLEDGE & MORTGAGE MANAGEMENT)
-- =============================================================

CREATE TABLE IF NOT EXISTS girvi_loans (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                        TEXT UNIQUE NOT NULL,
    loan_number                 TEXT UNIQUE NOT NULL,
    customer_id                 INTEGER REFERENCES customers(id),
    customer_name               TEXT NOT NULL,
    father_husband_name         TEXT,
    caste                       TEXT,
    phone1                      TEXT NOT NULL,
    address                     TEXT NOT NULL,
    loan_date                   TEXT NOT NULL,
    last_interest_date          TEXT,
    item_name                   TEXT NOT NULL,
    metal_type                  TEXT NOT NULL CHECK (metal_type IN ('gold', 'silver', 'mix', 'other')),
    gold_weight                 REAL DEFAULT 0.000,
    silver_weight               REAL DEFAULT 0.000,
    principal_amount            REAL NOT NULL,
    monthly_interest_percent    REAL NOT NULL DEFAULT 2.0,
    interest_type               TEXT NOT NULL DEFAULT 'simple' CHECK (interest_type IN ('simple', 'compound')),
    locker_number               TEXT,
    reference_person            TEXT,
    notes                       TEXT,
    photo_path                  TEXT,
    status                      TEXT NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'redeemed', 'partially_redeemed', 'auctioned', 'defaulted')),
    is_archived                 INTEGER NOT NULL DEFAULT 0,
    is_deleted                  INTEGER NOT NULL DEFAULT 0,
    deleted_at                  TEXT,
    data_source                 TEXT NOT NULL DEFAULT 'live' CHECK (data_source IN ('live', 'imported')),
    created_at                  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at                  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS girvi_transactions (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                        TEXT UNIQUE NOT NULL,
    girvi_loan_id               INTEGER NOT NULL REFERENCES girvi_loans(id),
    transaction_date            TEXT NOT NULL,
    transaction_type            TEXT NOT NULL CHECK (transaction_type IN ('loan_disbursement', 'interest_payment', 'principal_repayment', 'part_redemption', 'full_redemption', 'auction_closure')),
    amount                      REAL NOT NULL,
    interest_component          REAL DEFAULT 0,
    principal_component         REAL DEFAULT 0,
    remaining_principal         REAL NOT NULL,
    payment_method              TEXT DEFAULT 'cash',
    notes                       TEXT,
    user_id                     INTEGER REFERENCES users(id),
    created_at                  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS girvi_import_batches (
    id                          TEXT PRIMARY KEY,
    import_type                 TEXT NOT NULL DEFAULT 'csv',
    record_count                INTEGER NOT NULL DEFAULT 0,
    loan_ids_json               TEXT NOT NULL,
    is_undone                   INTEGER NOT NULL DEFAULT 0,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    undone_at                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_girvi_customer ON girvi_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_girvi_status ON girvi_loans(status);
CREATE INDEX IF NOT EXISTS idx_girvi_number ON girvi_loans(loan_number);
CREATE INDEX IF NOT EXISTS idx_girvi_phone ON girvi_loans(phone1);
CREATE INDEX IF NOT EXISTS idx_girvi_txn_loan ON girvi_transactions(girvi_loan_id);

-- =============================================================
-- 19. GOOGLE DRIVE FREE SYNC ENGINE & DEVICE PAIRING
-- =============================================================

CREATE TABLE IF NOT EXISTS sync_outbox (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name                 TEXT NOT NULL,
    entity_uuid                 TEXT NOT NULL,
    operation                   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload                     TEXT NOT NULL,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS authorized_devices (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                        TEXT UNIQUE NOT NULL,
    device_name                 TEXT NOT NULL,
    device_type                 TEXT NOT NULL CHECK (device_type IN ('desktop', 'mobile')),
    pairing_code                TEXT UNIQUE,
    is_active                   INTEGER NOT NULL DEFAULT 1,
    last_synced_at              TEXT,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS sync_tombstones (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name                 TEXT NOT NULL,
    entity_id                   INTEGER,
    entity_key                  TEXT,
    deleted_at                  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_name, entity_uuid);
CREATE INDEX IF NOT EXISTS idx_authorized_devices_uuid ON authorized_devices(uuid);
CREATE INDEX IF NOT EXISTS idx_tombstones_key ON sync_tombstones(entity_name, entity_key);


