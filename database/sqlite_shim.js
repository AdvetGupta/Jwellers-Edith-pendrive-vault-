const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let SQL = null;

class Statement {
  constructor(db, sqlText) {
    this.db = db;
    this.sqlText = sqlText;
  }

  _makeStmt() {
    // Always create a fresh statement to avoid state pollution from reuse
    return this.db._raw.prepare(this.sqlText);
  }

  _resolveParams(params) {
    if (params === undefined || params === null) return [];
    if (Array.isArray(params)) return params.map(p => (p === undefined ? null : p));
    return [params === undefined ? null : params];
  }

  run(...params) {
    const stmt = this._makeStmt();
    const resolved = this._resolveParams(params);
    try {
      if (resolved.length > 0) {
        stmt.bind(resolved);
      }
      stmt.step();
      const changes = this.db._raw.getRowsModified();
      stmt.free();

      // Immediately cache last_insert_rowid before any export serialization resets it
      try {
        const idStmt = this.db._raw.prepare('SELECT last_insert_rowid() as id');
        if (idStmt.step()) {
          this.db._cachedLastInsertRowid = idStmt.getAsObject().id;
        }
        idStmt.free();
      } catch (_) {}

      // Synchronous immediate disk flush for critical business tables when not inside open transaction
      if (!this.db.inTransaction && /^\s*(INSERT|UPDATE|DELETE)\s+(INTO\s+)?(bills|customers|girvi_loans|khata_transactions|payments|users)\b/i.test(this.sqlText)) {
        this.db.flushSync();
      } else if (!this.db.inTransaction) {
        this.db._scheduleSave();
      }
      return { changes };
    } catch (err) {
      try { stmt.free(); } catch (_) {}
      throw err;
    }
  }

  get(...params) {
    const stmt = this._makeStmt();
    const resolved = this._resolveParams(params);
    try {
      if (resolved.length > 0) {
        stmt.bind(resolved);
      }
      let row;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
      return row;
    } catch (err) {
      try { stmt.free(); } catch (_) {}
      throw err;
    }
  }

  all(...params) {
    const stmt = this._makeStmt();
    const resolved = this._resolveParams(params);
    const rows = [];
    try {
      if (resolved.length > 0) {
        stmt.bind(resolved);
      }
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      try { stmt.free(); } catch (_) {}
      throw err;
    }
  }

  free() {
    // No-op since we no longer cache the stmt
  }
}

class Database {
  constructor(dbPath, options) {
    this.dbPath = dbPath;
    this._raw = null;
    this._saveScheduled = false;
  }

  async init() {
    if (!SQL) {
      SQL = await initSqlJs();
    }

    if (this.dbPath && fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this._raw = new SQL.Database(buffer);
    } else {
      this._raw = new SQL.Database();
    }

    // Use exec() (multi-statement capable) for pragmas
    this._raw.exec('PRAGMA foreign_keys = ON');
    this._raw.exec('PRAGMA busy_timeout = 5000');

    return this;
  }

  prepare(sqlText) {
    return new Statement(this, sqlText);
  }

  exec(sql) {
    if (/^\s*(BEGIN|SAVEPOINT)\b/i.test(sql)) {
      this.inTransaction = true;
    }
    this._raw.exec(sql);
    if (/^\s*(COMMIT|RELEASE|ROLLBACK)\b/i.test(sql)) {
      this.inTransaction = false;
      this.flushSync();
    } else if (!this.inTransaction) {
      this._scheduleSave();
    }
  }

  pragma(key, value) {
    if (value !== undefined) {
      this._raw.exec(`PRAGMA ${key} = ${value}`);
    } else if (typeof key === 'string' && key.includes('=')) {
      const eqIdx = key.indexOf('=');
      const k = key.substring(0, eqIdx).trim();
      const v = key.substring(eqIdx + 1).trim();
      this._raw.exec(`PRAGMA ${k} = ${v}`);
    } else {
      const stmt = this._raw.prepare(`PRAGMA ${key}`);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  }

  _scheduleSave() {
    // Non-blocking background disk write for portable USB vault (250ms debounce)
    if (this._saveScheduled) return;
    this._saveScheduled = true;
    setTimeout(() => {
      this._saveScheduled = false;
      this._saveToFileAsync();
    }, 250);
  }

  async _saveToFileAsync() {
    if (this.dbPath && this._raw && this.dbPath !== ':memory:') {
      try {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
        }
        // Atomic Rolling Backup before async save
        if (fs.existsSync(this.dbPath)) {
          const bakPath = `${this.dbPath}.bak`;
          try {
            await fs.promises.copyFile(this.dbPath, bakPath);
          } catch (bakErr) {
            console.warn('[sqlite_shim] Async rolling backup notice:', bakErr.message);
          }
        }
        const data = this._raw.export();
        const tempPath = `${this.dbPath}.tmp_${Date.now()}`;
        await fs.promises.writeFile(tempPath, Buffer.from(data));
        await fs.promises.rename(tempPath, this.dbPath);
      } catch (err) {
        console.error('[sqlite_shim] Async background save error:', err.message);
      }
    }
  }

  close() {
    if (this._raw) {
      this._saveToFile();
      this._raw.close();
      this._raw = null;
    }
  }

  backup(destinationPath, options) {
    this._saveToFile();
    if (destinationPath && this.dbPath && destinationPath !== this.dbPath) {
      if (fs.existsSync(this.dbPath)) {
        fs.copyFileSync(this.dbPath, destinationPath);
      } else {
        const data = this._raw.export();
        const dir = path.dirname(destinationPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(destinationPath, Buffer.from(data));
      }
    }
  }

  flushSync() {
    if (this.inTransaction) return;
    this._saveScheduled = false;
    this._saveToFile();
  }

  _saveToFile() {
    if (this.dbPath && this._raw && this.dbPath !== ':memory:') {
      try {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Atomic Rolling Backup: Keep previous copy as .bak before overwriting
        if (fs.existsSync(this.dbPath)) {
          const bakPath = `${this.dbPath}.bak`;
          try {
            fs.copyFileSync(this.dbPath, bakPath);
          } catch (bakErr) {
            console.warn('[sqlite_shim] Rolling backup notice:', bakErr.message);
          }
        }
        const data = this._raw.export();
        const tempPath = `${this.dbPath}.tmp_${Date.now()}`;
        fs.writeFileSync(tempPath, Buffer.from(data));
        fs.renameSync(tempPath, this.dbPath);
      } catch (err) {
        console.error('[sqlite_shim] Failed to save database to disk:', err.message);
      }
    }
  }

  get lastInsertRowid() {
    if (this._cachedLastInsertRowid !== undefined && this._cachedLastInsertRowid !== 0) {
      return this._cachedLastInsertRowid;
    }
    if (!this._raw) return 0;
    try {
      const stmt = this._raw.prepare('SELECT last_insert_rowid() as id');
      let id = 0;
      if (stmt.step()) {
        id = stmt.getAsObject().id;
      }
      stmt.free();
      return id;
    } catch (_) {
      return 0;
    }
  }
}

module.exports = { Database };
