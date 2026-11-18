const ALLOWED_SORT_DIRECTIONS = ['ASC', 'DESC', 'asc', 'desc'];

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100000, Math.max(1, parseInt(query.pageSize, 10) || 50));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function parseSort(query, allowedColumns, defaultSort = 'id') {
  let sortColumn = defaultSort;
  let sortDirection = 'ASC';

  if (query.sortColumn && allowedColumns.includes(query.sortColumn)) {
    sortColumn = query.sortColumn;
  }

  if (query.sortDirection && ALLOWED_SORT_DIRECTIONS.includes(query.sortDirection)) {
    sortDirection = query.sortDirection.toUpperCase();
  }

  return { sortColumn, sortDirection };
}

function buildMeta(total, page, pageSize) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    hasNext: page * pageSize < total,
    hasPrev: page > 1
  };
}

function buildOrderClause(sortColumn, sortDirection, tableAlias = null) {
  const col = tableAlias ? `${tableAlias}.${sortColumn}` : sortColumn;
  return `ORDER BY ${col} ${sortDirection}`;
}

module.exports = { parsePagination, parseSort, buildMeta, buildOrderClause, ALLOWED_SORT_DIRECTIONS };
