const ACTIVITY_SCREEN = {
  _logs: [],
  _pagination: null,
  _currentPage: 1,
  _filterUser: '',
  _filterAction: '',
  _filterDateFrom: '',
  _filterDateTo: '',
  _searchTerm: '',

  render() {
    return `
      <div class="activity-page">
        <div class="page-header">
          <h2>Activity Log</h2>
        </div>
        <div id="activity-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div id="activity-modal-container"></div>
      </div>`;
  },

  async init() {
    await this._load();
  },

  async _load() {
    try {
      const params = {
        page: this._currentPage,
        pageSize: 25,
        search: this._searchTerm || undefined
      };
      if (this._filterUser) params.user_id = parseInt(this._filterUser, 10);
      if (this._filterAction) params.action = this._filterAction;
      if (this._filterDateFrom) params.date_from = this._filterDateFrom;
      if (this._filterDateTo) params.date_to = this._filterDateTo;

      const result = await API.invoke('audit:search', params);
      this._logs = result.data || [];
      this._pagination = result.pagination;
      this._renderView();
    } catch (err) {
      document.getElementById('activity-content').innerHTML =
        `<div class="alert alert-error">Failed to load: ${this._escape(err.message)}</div>`;
    }
  },

  _renderView() {
    const container = document.getElementById('activity-content');
    if (!container) return;

    container.innerHTML = `
      <div class="activity-filters">
        <div class="activity-filter-row">
          <input type="text" class="form-control" id="activity-search" placeholder="Search description..." value="${this._escape(this._searchTerm)}" autocomplete="off" style="width:200px">
          <input type="date" class="form-control" id="activity-filter-from" value="${this._filterDateFrom}" style="width:150px">
          <span class="text-muted">to</span>
          <input type="date" class="form-control" id="activity-filter-to" value="${this._filterDateTo}" style="width:150px">
          <button class="btn btn-sm btn-primary" id="activity-filter-apply">Apply</button>
          <button class="btn btn-sm btn-secondary" id="activity-filter-clear">Clear</button>
        </div>
      </div>
      <div class="activity-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${this._renderRows()}
          </tbody>
        </table>
      </div>
      <div id="activity-pagination"></div>`;

    this._bindEvents();
    this._renderPagination();
  },

  _renderRows() {
    if (!this._logs || this._logs.length === 0) {
      return '<tr><td colspan="5" class="table-empty">No activity logs found</td></tr>';
    }
    return this._logs.map(log => {
      const date = log.created_at ? new Date(log.created_at + 'T00:00:00').toLocaleString() : '--';
      return `
        <tr>
          <td class="text-muted" style="white-space:nowrap">${date}</td>
          <td>${this._escape(log.user_name || log.user_id || 'System')}</td>
          <td><span class="badge badge-${this._actionBadge(log.action)}">${this._escape(log.action || '')}</span></td>
          <td class="text-muted">${this._escape(log.entity_type || '')}${log.entity_id ? ' #' + log.entity_id : ''}</td>
          <td>${this._escape(log.description || '')}</td>
        </tr>`;
    }).join('');
  },

  _actionBadge(action) {
    if (!action) return 'secondary';
    const a = action.toLowerCase();
    if (a.includes('create') || a.includes('login')) return 'success';
    if (a.includes('cancel') || a.includes('delete') || a.includes('deact') || a.includes('failed')) return 'danger';
    if (a.includes('update') || a.includes('edit') || a.includes('change') || a.includes('reset')) return 'warning';
    return 'info';
  },

  _renderPagination() {
    const el = document.getElementById('activity-pagination');
    if (!el) return;
    const p = this._pagination;
    if (!p || p.totalPages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="pagination">
        <span class="pagination-info">${p.total} entries — Page ${p.page} of ${p.totalPages}</span>
        <div class="pagination-btns">
          <button class="btn btn-sm btn-secondary" onclick="window.ACTIVITY_SCREEN._goPage(1)" ${p.page <= 1 ? 'disabled' : ''}>First</button>
          <button class="btn btn-sm btn-secondary" onclick="window.ACTIVITY_SCREEN._goPage(${p.page - 1})" ${!p.hasPrev ? 'disabled' : ''}>Prev</button>
          <button class="btn btn-sm btn-secondary" onclick="window.ACTIVITY_SCREEN._goPage(${p.page + 1})" ${!p.hasNext ? 'disabled' : ''}>Next</button>
          <button class="btn btn-sm btn-secondary" onclick="window.ACTIVITY_SCREEN._goPage(${p.totalPages})" ${p.page >= p.totalPages ? 'disabled' : ''}>Last</button>
        </div>
      </div>`;
  },

  _goPage(page) {
    this._currentPage = page;
    this._load().catch(e => console.error('Activity pagination error:', e));
  },

  _bindEvents() {
    const safeLoad = () => this._load().catch(e => console.error('Activity load error:', e));
    document.getElementById('activity-filter-apply')?.addEventListener('click', () => {
      this._searchTerm = document.getElementById('activity-search')?.value || '';
      this._filterDateFrom = document.getElementById('activity-filter-from')?.value || '';
      this._filterDateTo = document.getElementById('activity-filter-to')?.value || '';
      this._currentPage = 1;
      safeLoad();
    });
    document.getElementById('activity-filter-clear')?.addEventListener('click', () => {
      this._searchTerm = '';
      this._filterDateFrom = '';
      this._filterDateTo = '';
      this._currentPage = 1;
      safeLoad();
    });
    document.getElementById('activity-search')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('activity-filter-apply')?.click();
    });
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.ACTIVITY_SCREEN = ACTIVITY_SCREEN;