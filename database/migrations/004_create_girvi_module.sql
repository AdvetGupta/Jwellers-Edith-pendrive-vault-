-- =============================================================
-- Migration 004: Create Girvi Module Tables & Indexes
-- Version: 4
-- Description: Adds girvi_loans and girvi_transactions tables
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
    item_name                   TEXT NOT NULL,
    metal_type                  TEXT NOT NULL CHECK (metal_type IN ('gold', 'silver', 'mix', 'other')),
    gold_weight                 REAL DEFAULT 0.000,
    silver_weight               REAL DEFAULT 0.000,
    principal_amount            REAL NOT NULL,
    monthly_interest_percent    REAL NOT NULL DEFAULT 2.0,
    interest_type               TEXT NOT NULL DEFAULT 'simple',
    locker_number               TEXT,
    reference_person            TEXT,
    notes                       TEXT,
    photo_path                  TEXT,
    status                      TEXT NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'redeemed', 'partially_redeemed', 'auctioned', 'defaulted')),
    is_archived                 INTEGER NOT NULL DEFAULT 0,
    is_deleted                  INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_girvi_customer ON girvi_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_girvi_status ON girvi_loans(status);
CREATE INDEX IF NOT EXISTS idx_girvi_number ON girvi_loans(loan_number);
CREATE INDEX IF NOT EXISTS idx_girvi_phone ON girvi_loans(phone1);
CREATE INDEX IF NOT EXISTS idx_girvi_txn_loan ON girvi_transactions(girvi_loan_id);
