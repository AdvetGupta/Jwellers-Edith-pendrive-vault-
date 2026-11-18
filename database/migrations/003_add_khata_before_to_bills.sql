-- Safely add khata_before column by recreating the table
-- Works for both fresh DBs (column exists) and existing DBs (column missing)
-- Must disable FK checks during copy in case the user has orphan references

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS bills_new (
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

INSERT INTO bills_new (
    id, invoice_number, bill_type, customer_id, user_id, bill_date,
    subtotal, discount_percentage, discount_amount,
    making_charge_total, stone_charge_total, wastage_total,
    taxable_amount, cgst_rate, sgst_rate, igst_rate,
    cgst_amount, sgst_amount, igst_amount,
    tax_total, round_off, grand_total,
    paid_amount, balance_amount, payment_status,
    notes, status, cancellation_reason,
    is_migrated, migration_batch_id, original_date,
    created_at, updated_at
)
SELECT
    id, invoice_number, bill_type, customer_id, user_id, bill_date,
    subtotal, discount_percentage, discount_amount,
    making_charge_total, stone_charge_total, wastage_total,
    taxable_amount, cgst_rate, sgst_rate, igst_rate,
    cgst_amount, sgst_amount, igst_amount,
    tax_total, round_off, grand_total,
    paid_amount, balance_amount, payment_status,
    notes, status, cancellation_reason,
    is_migrated, migration_batch_id, original_date,
    created_at, updated_at
FROM bills;

DROP TABLE bills;

ALTER TABLE bills_new RENAME TO bills;

CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_type ON bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_invoice ON bills(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_migrated ON bills(is_migrated);

PRAGMA foreign_keys = ON;

