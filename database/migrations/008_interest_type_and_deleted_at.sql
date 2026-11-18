-- Migration 008: Add interest_type to girvi_loans + deleted_at to both girvi_loans and customers
-- Safe to run on existing databases — ALTER TABLE ignores if column already exists

-- Add interest_type to girvi_loans (controls which method is charged: simple or compound)
ALTER TABLE girvi_loans ADD COLUMN interest_type TEXT NOT NULL DEFAULT 'simple';

-- Add deleted_at timestamp to girvi_loans
ALTER TABLE girvi_loans ADD COLUMN deleted_at TEXT;

-- Add deleted_at timestamp to customers
ALTER TABLE customers ADD COLUMN deleted_at TEXT;

-- Record this migration
INSERT OR IGNORE INTO schema_migrations (version, name, applied_by, success)
VALUES (8, 'Add interest_type and deleted_at columns', 'system', 1);
