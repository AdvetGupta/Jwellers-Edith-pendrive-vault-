const { getDb } = require('../database/connection');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { validateId } = require('../validation');

class AuditService {
  search(query = {}) {
    const { page, pageSize } = parsePagination(query);
    const db = getDb();

    const conditions = [];
    const params = [];

    if (query.user_id) {
      conditions.push("a.user_id = ?");
      params.push(validateId(query.user_id));
    }

    if (query.action) {
      conditions.push("a.action = ?");
      params.push(query.action);
    }

    if (query.entity_type) {
      conditions.push("a.entity_type = ?");
      params.push(query.entity_type);
    }

    if (query.date_from) {
      conditions.push("a.created_at >= ?");
      params.push(query.date_from);
    }

    if (query.date_to) {
      conditions.push("a.created_at <= ?");
      params.push(query.date_to);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as count FROM activity_logs a ${whereClause}`;
    const total = db.prepare(countSql).get(...params).count;

    const dataSql = `
      SELECT a.*, u.display_name as user_name
      FROM activity_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`;
    const data = db.prepare(dataSql).all(...params, pageSize, (page - 1) * pageSize);

    return { data, pagination: buildMeta(total, page, pageSize) };
  }

  getRecent(limit = 20) {
    const db = getDb();
    return db.prepare(`
      SELECT a.*, u.display_name as user_name
      FROM activity_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit);
  }
}

module.exports = new AuditService();
