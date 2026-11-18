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
      // Persist to disk after every write so data is not lost on crash
      this.db._scheduleSave();
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
    // Use _raw.exec() which supports multiple statements separated by semicolons
    // (sql.js run() only executes the first statement)
    this._raw.exec(sql);
    this._scheduleSave();
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
    if (this.dbPath && this._raw) {
      try {
        const data = this._raw.export();
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
        }
        await fs.promises.writeFile(this.dbPath, Buffer.from(data));
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

  _saveToFile() {
    if (this.dbPath && this._raw) {
      try {
        const data = this._raw.export();
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.dbPath, Buffer.from(data));
      } catch (err) {
        console.error('[sqlite_shim] Failed to save database to disk:', err.message);
      }
    }
  }

  get lastInsertRowid() {
    if (!this._raw) return 0;
    const stmt = this._raw.prepare('SELECT last_insert_rowid() as id');
    let id = 0;
    if (stmt.step()) {
      id = stmt.getAsObject().id;
    }
    stmt.free();
    return id;
  }
}

module.exports = { Database };
