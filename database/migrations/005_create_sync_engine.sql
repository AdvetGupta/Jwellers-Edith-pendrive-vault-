-- =============================================================
-- Migration 005: Create Sync Engine & Device Pairing Tables
-- Version: 5
-- Description: Adds sync_outbox and authorized_devices tables
-- =============================================================

CREATE TABLE IF NOT EXISTS sync_outbox (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name                 TEXT NOT NULL, -- 'customers', 'bills', 'girvi_loans', 'khata_transactions'
    entity_uuid                 TEXT NOT NULL,
    operation                   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload                     TEXT NOT NULL, -- JSON string payload
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

CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_name, entity_uuid);
CREATE INDEX IF NOT EXISTS idx_authorized_devices_uuid ON authorized_devices(uuid);
