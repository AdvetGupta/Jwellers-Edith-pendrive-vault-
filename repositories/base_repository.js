const { getDb } = require('../database/connection');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  getDb() {
    return getDb();
  }

  findById(id) {
    const stmt = this.getDb().prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    return stmt.get(id) || null;
  }

  findAll(options = {}) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const conditions = [];
    const params = [];

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (options.whereRaw) {
      conditions.push(options.whereRaw);
      if (options.params) {
        params.push(...options.params);
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit) {
      sql += ` LIMIT ${parseInt(options.limit, 10)}`;
      if (options.offset) {
        sql += ` OFFSET ${parseInt(options.offset, 10)}`;
      }
    }

    return this.getDb().prepare(sql).all(...params);
  }

  findOne(options = {}) {
    const results = this.findAll({ ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  count(options = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const conditions = [];
    const params = [];

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (options.whereRaw) {
      conditions.push(options.whereRaw);
      if (options.params) {
        params.push(...options.params);
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const row = this.getDb().prepare(sql).get(...params);
    return row ? row.count : 0;
  }

  create(data) {
    const db = this.getDb();
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?');
    const values = columns.map(col => data[col]);

    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const stmt = db.prepare(sql);
    stmt.run(...values);
    const id = db.lastInsertRowid;

    return { id, changes: 1 };
  }

  update(id, data) {
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => data[col]);

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    const stmt = this.getDb().prepare(sql);
    stmt.run(...values, id);

    return { changes: 1 };
  }

  delete(id, permanent = false) {
    if (permanent) {
      const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const stmt = this.getDb().prepare(sql);
      stmt.run(id);
      return { changes: 1 };
    }

    try {
      const sql = `UPDATE ${this.tableName} SET is_deleted = 1, deleted_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`;
      this.getDb().prepare(sql).run(id);
    } catch (_) {
      const sql = `UPDATE ${this.tableName} SET is_deleted = 1, updated_at = datetime('now', 'localtime') WHERE id = ?`;
      this.getDb().prepare(sql).run(id);
    }
    return { changes: 1 };
  }


  paginate(options = {}) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(options.pageSize, 10) || 50));
    const offset = (page - 1) * pageSize;

    const total = this.count(options);
    const data = this.findAll({ ...options, limit: pageSize, offset });

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrev: page > 1
      }
    };
  }

  exists(conditions) {
    const count = this.count({ where: conditions });
    return count > 0;
  }
}

module.exports = BaseRepository;
