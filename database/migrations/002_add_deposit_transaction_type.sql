CREATE TABLE IF NOT EXISTS khata_transactions_new (
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

INSERT INTO khata_transactions_new SELECT * FROM khata_transactions;

DROP TABLE khata_transactions;

ALTER TABLE khata_transactions_new RENAME TO khata_transactions;

CREATE INDEX IF NOT EXISTS idx_khata_customer ON khata_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_khata_date ON khata_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_khata_type ON khata_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_khata_bill ON khata_transactions(bill_id);
CREATE INDEX IF NOT EXISTS idx_khata_payment ON khata_transactions(payment_id);
