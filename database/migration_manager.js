const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('./connection');

class MigrationManager {
  constructor(migrationsDir) {
    this.migrationsDir = migrationsDir || path.join(__dirname, 'migrations');
  }

  ensureMigrationTable() {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        version     INTEGER NOT NULL UNIQUE,
        name        TEXT    NOT NULL,
        sql_checksum TEXT,
        applied_by  TEXT,
        applied_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        success     INTEGER NOT NULL DEFAULT 1,
        duration_ms INTEGER
      )
    `);
  }

  getAppliedVersions() {
    const db = getDb();
    const rows = db.prepare('SELECT version FROM schema_migrations WHERE success = 1 ORDER BY version').all();
    return rows.map(r => r.version);
  }

  loadMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const filePath = path.join(this.migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const versionMatch = file.match(/^(\d+)_/);
      const version = versionMatch ? parseInt(versionMatch[1], 10) : 0;
      const name = file.replace(/\.sql$/, '');

      return {
        file,
        filePath,
        version,
        name,
        content,
        checksum: crypto.createHash('sha256').update(content).digest('hex')
      };
    }).filter(m => m.version > 0).sort((a, b) => a.version - b.version);
  }

  runMigrations(options = {}) {
    const db = getDb();
    const appliedBy = options.appliedBy || 'system';
    const targetVersion = options.targetVersion || null;

    this.ensureMigrationTable();
    const appliedVersions = this.getAppliedVersions();
    const migrations = this.loadMigrationFiles();

    let filtered = migrations.filter(m => !appliedVersions.includes(m.version));
    if (targetVersion) {
      filtered = filtered.filter(m => m.version <= targetVersion);
    }

    if (filtered.length === 0) {
      return { applied: [], message: 'Database is up to date.' };
    }

    const results = [];

    for (const migration of filtered) {
      const startTime = Date.now();
      let success = false;

      try {
        db.exec('PRAGMA foreign_keys = OFF');
        db.exec('BEGIN IMMEDIATE TRANSACTION');
        db.exec(migration.content);
        db.exec(`
          INSERT OR REPLACE INTO schema_migrations (version, name, sql_checksum, applied_by, success, duration_ms)
          VALUES (${migration.version}, '${migration.name.replace(/'/g, "''")}', '${migration.checksum}', '${appliedBy.replace(/'/g, "''")}', 1, ${Date.now() - startTime})
        `);
        db.exec('COMMIT');
        db.exec('PRAGMA foreign_keys = ON');
        success = true;
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch (e) {}
        try { db.exec('PRAGMA foreign_keys = ON'); } catch (e) {}
        if (error.message.includes('duplicate column name') || error.message.includes('already exists') || error.message.includes('UNIQUE constraint failed')) {
          try {
            db.exec(`
              INSERT OR REPLACE INTO schema_migrations (version, name, sql_checksum, applied_by, success, duration_ms)
              VALUES (${migration.version}, '${migration.name.replace(/'/g, "''")}', '${migration.checksum}', '${appliedBy.replace(/'/g, "''")}', 1, ${Date.now() - startTime})
            `);
            success = true;
          } catch (e) {}
        }
        if (!success) {
          console.error(`Migration v${migration.version} (${migration.name}) FAILED:`, error.message);
          results.push({
            version: migration.version,
            name: migration.name,
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
          });
          throw new Error(`Migration v${migration.version} failed: ${error.message}`);
        }
      }

      if (success) {
        results.push({
          version: migration.version,
          name: migration.name,
          success: true,
          duration_ms: Date.now() - startTime
        });
      }
    }

    return { applied: results, message: `Applied ${results.length} migration(s).` };
  }

  getCurrentVersion() {
    const db = getDb();
    const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations WHERE success = 1').get();
    return row && row.version ? row.version : 0;
  }

  getMigrationStatus() {
    this.ensureMigrationTable();
    const db = getDb();
    const applied = db.prepare('SELECT version, name, applied_at, success, duration_ms FROM schema_migrations ORDER BY version').all();
    const files = this.loadMigrationFiles();

    return {
      currentVersion: applied.filter(a => a.success).length > 0 ? Math.max(...applied.filter(a => a.success).map(a => a.version)) : 0,
      applied,
      pending: files.filter(f => !applied.some(a => a.version === f.version && a.success)).map(f => ({
        version: f.version,
        name: f.name
      }))
    };
  }
}

module.exports = MigrationManager;
