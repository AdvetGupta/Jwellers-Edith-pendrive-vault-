-- =============================================================
-- Migration 006: Add Caste / Jaati Column to Girvi Loans
-- Version: 6
-- Description: Adds caste field to girvi_loans
-- =============================================================

ALTER TABLE girvi_loans ADD COLUMN caste TEXT;
