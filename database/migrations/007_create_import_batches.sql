-- =============================================================
-- Migration 007: Create Girvi Import Batches Table for Persistent Undo/Redo
-- Version: 7
-- Description: Tracks all CSV/Excel import batches persistently
-- =============================================================

CREATE TABLE IF NOT EXISTS girvi_import_batches (
    id                  TEXT PRIMARY KEY,
    import_type         TEXT NOT NULL DEFAULT 'csv',
    record_count        INTEGER NOT NULL DEFAULT 0,
    loan_ids_json       TEXT NOT NULL,
    is_undone           INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    undone_at           TEXT
);
