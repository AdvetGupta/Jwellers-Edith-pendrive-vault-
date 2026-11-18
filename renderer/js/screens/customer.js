const CUSTOMER_SCREEN = {
  _customers: [],
  _membershipLevels: [],
  _pagination: null,
  _counts: null,
  _searchTerm: '',
  _filterCity: '',
  _filterMembership: '',
  _filterArchived: 'active',
  _sortColumn: 'created_at',
  _sortDirection: 'DESC',
  _currentPage: 1,
  _pageSize: 50,
  _detailCustomer: null,

  async render() {
    return `
      <div class="customer-page">
        <div class="page-header">
          <h2>Customers</h2>
          <div class="page-header-actions">
            <button class="btn btn-sm btn-secondary" id="customer-export-btn">Export CSV</button>
            <button class="btn btn-sm btn-secondary" id="customer-page-refresh-btn">🔄 Refresh</button>
            ${APP_STATE.hasPermission('customer.create') ? '<button class="btn btn-primary" id="customer-add-btn">+ Add Customer</button>' : ''}
          </div>
        </div>
        <div id="customer-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div id="customer-modal-container"></div>
      </div>
    `;
  },

  async init() {
    this._membershipLevels = await API.invoke('membership:list') || [];
    await this._load();
    document.getElementById('customer-add-btn')?.addEventListener('click', () => this._showFormModal('Add Customer', null));
    document.getElementById('customer-export-btn')?.addEventListener('click', () => this._exportCSV());
    document.getElementById('customer-page-refresh-btn')?.addEventListener('click', () => this._load());

    window.removeEventListener('customer-changed', this._onCustomerChanged);
    this._onCustomerChanged = () => this._load().catch(() => {});
    window.addEventListener('customer-changed', this._onCustomerChanged);
  },

  async _load() {
    try {
      const params = {
        page: this._currentPage,
        pageSize: this._pageSize || 50,
        sortColumn: this._sortColumn,
        sortDirection: this._sortDirection
      };
      if (this._searchTerm) params.search = this._searchTerm;
      if (this._filterCity) params.city = this._filterCity;
      if (this._filterMembership) params.membership_level_id = this._filterMembership;
      if (this._filterArchived === 'archived') params.is_archived = true;
      else if (this._filterArchived === 'active') params.is_archived = false;

      const [result, counts] = await Promise.all([
        API.invoke('customer:search', params),
        API.invoke('customer:counts').catch(() => null)
      ]);
      this._customers = result.data || [];
      this._pagination = result.pagination;
      this._counts = counts;
      this._renderList();
    } catch (err) {
      document.getElementById('customer-content').innerHTML = `<div class="alert alert-error">Failed to load customers: ${this._escape(err.message)}</div>`;
    }
  },

  _renderList() {
    const container = document.getElementById('customer-content');
    if (!container) return;

    const cities = [...new Set(this._customers.filter(c => c.city).map(c => c.city))].sort();
    const uniqueCities = cities.length > 0 ? cities : [];
    const totalCount = this._counts ? this._counts.total : (this._pagination ? this._pagination.total : 0);
    const activeCount = this._counts ? this._counts.active : '-';
    const archivedCount = this._counts ? this._counts.archived : '-';

    container.innerHTML = `
      <div class="customer-count-banner" style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-card);padding:10px 16px;border-radius:var(--radius);margin-bottom:12px;border:1px solid var(--border)">
        <div style="font-size:14px;font-weight:600">
          <span>Total Customers: ${totalCount}</span>
          <span class="text-muted" style="margin-left:12px;font-size:13px;font-weight:normal">(Active: ${activeCount} | Archived: ${archivedCount})</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-sm btn-primary" id="customer-realign-queue-btn" style="padding:4px 10px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;" title="1-Click: Re-align all customer IDs into sequence (CUST-0001, CUST-0002...)">⚡ 1-Click Queue</button>
        </div>
      </div>

      <div class="customer-filters">
        <div class="customer-search">
          <input type="text" id="customer-search-input" class="form-control" placeholder="Search by name, phone, customer ID, city, address..." value="${this._escape(this._searchTerm)}">
          <button class="btn btn-primary" id="customer-search-btn">Search</button>
          ${this._searchTerm ? '<button class="btn btn-secondary" id="customer-clear-btn">Clear</button>' : ''}
        </div>
        <div class="customer-filter-row">
          <select id="filter-sort-queue" class="form-control filter-select" style="max-width:190px;" title="Sort Queue / Customer Order">
            <option value="created_at_desc" ${this._sortColumn === 'created_at' && this._sortDirection === 'DESC' ? 'selected' : ''}>📅 Date: Newest First</option>
            <option value="created_at_asc" ${this._sortColumn === 'created_at' && this._sortDirection === 'ASC' ? 'selected' : ''}>📅 Date: Oldest First</option>
            <option value="name_asc" ${this._sortColumn === 'name' && this._sortDirection === 'ASC' ? 'selected' : ''}>🔤 Name: A to Z</option>
            <option value="name_desc" ${this._sortColumn === 'name' && this._sortDirection === 'DESC' ? 'selected' : ''}>🔤 Name: Z to A</option>
            <option value="city_asc" ${this._sortColumn === 'city' && this._sortDirection === 'ASC' ? 'selected' : ''}>📍 Place / Village (A-Z)</option>
            <option value="customer_id_asc" ${this._sortColumn === 'customer_id' && this._sortDirection === 'ASC' ? 'selected' : ''}>🔢 Queue ID: CUST-0001 First</option>
          </select>
          <select id="filter-city" class="form-control filter-select">
            <option value="">All Cities</option>
            ${uniqueCities.map(c => `<option value="${this._escape(c)}" ${this._filterCity === c ? 'selected' : ''}>${this._escape(c)}</option>`).join('')}
          </select>
          <select id="filter-membership" class="form-control filter-select">
            <option value="">All Levels</option>
            ${this._membershipLevels.map(m => `<option value="${m.id}" ${this._filterMembership == m.id ? 'selected' : ''}>${this._escape(m.name)}</option>`).join('')}
          </select>
          <select id="filter-archived" class="form-control filter-select">
            <option value="active" ${this._filterArchived === 'active' ? 'selected' : ''}>Active</option>
            <option value="archived" ${this._filterArchived === 'archived' ? 'selected' : ''}>Archived</option>
            <option value="all" ${this._filterArchived === 'all' ? 'selected' : ''}>All</option>
          </select>
          <select id="filter-pagesize" class="form-control filter-select" style="max-width:140px;" title="Customers per page (up to 1 Lakh)">
            <option value="25" ${this._pageSize === 25 ? 'selected' : ''}>25 / page</option>
            <option value="50" ${this._pageSize === 50 ? 'selected' : ''}>50 / page</option>
            <option value="100" ${this._pageSize === 100 ? 'selected' : ''}>100 / page</option>
            <option value="500" ${this._pageSize === 500 ? 'selected' : ''}>500 / page</option>
            <option value="1000" ${this._pageSize === 1000 ? 'selected' : ''}>1,000 / page</option>
            <option value="5000" ${this._pageSize === 5000 ? 'selected' : ''}>5,000 / page</option>
            <option value="100000" ${this._pageSize === 100000 ? 'selected' : ''}>All (1 Lakh)</option>
          </select>
        </div>
      </div>
      <div class="customer-table-wrapper">
        <table class="data-table customer-table">
          <thead>
            <tr>
              <th class="sortable" data-col="customer_id" onclick="window.CUSTOMER_SCREEN._toggleSort('customer_id')">Customer ID ${this._sortIcon('customer_id')}</th>
              <th class="sortable" data-col="name" onclick="window.CUSTOMER_SCREEN._toggleSort('name')">Name ${this._sortIcon('name')}</th>
              <th class="sortable" data-col="phone1" onclick="window.CUSTOMER_SCREEN._toggleSort('phone1')">Phone ${this._sortIcon('phone1')}</th>
              <th class="sortable" data-col="city" onclick="window.CUSTOMER_SCREEN._toggleSort('city')">City ${this._sortIcon('city')}</th>
              <th>Membership</th>
              <th class="sortable" data-col="created_at" onclick="window.CUSTOMER_SCREEN._toggleSort('created_at')">Created ${this._sortIcon('created_at')}</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this._customers.length === 0 ? '<tr><td colspan="8" class="table-empty">No customers found</td></tr>' : ''}
            ${this._customers.map(c => this._renderRow(c)).join('')}
          </tbody>
        </table>
      </div>
      ${this._renderPagination()}
    `;

    this._bindEvents();
  },

  _renderRow(c) {
    const memberName = this._membershipLevels.find(m => m.id === c.membership_level_id)?.name || '';
    const createdDate = c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '';
    const isArchived = !!c.is_archived;
    const canEdit = APP_STATE.hasPermission('customer.edit');
    const canDelete = APP_STATE.hasPermission('customer.delete');

    return `
      <tr class="${isArchived ? 'row-archived' : ''}">
        <td><a class="customer-id-link" onclick="window.CUSTOMER_SCREEN._showDetail(${c.id})">${this._escape(c.customer_id)}</a></td>
        <td>
          <strong>${this._escape(c.name)}</strong>
          ${c.relation ? `<div style="font-size:11px;color:var(--text-muted);">${this._escape(c.relation)}</div>` : ''}
        </td>
        <td>${this._escape(c.phone1 || '')}</td>
        <td>${this._escape(c.city || '')}</td>
        <td>${memberName ? `<span class="badge badge-membership">${this._escape(memberName)}</span>` : ''}</td>
        <td class="text-muted">${createdDate}</td>
        <td>${isArchived ? '<span class="badge badge-inactive">Archived</span>' : '<span class="badge badge-active">Active</span>'}</td>
        <td>
          <div class="cell-actions">
            <button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._showDetail(${c.id})" title="View">View</button>
            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._showEdit(${c.id})" title="Edit">Edit</button>` : ''}
            ${canEdit ? (isArchived
              ? `<button class="btn btn-sm btn-success" onclick="window.CUSTOMER_SCREEN._unarchive(${c.id})" title="Unarchive">Unarchive</button>`
              : `<button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._archive(${c.id})" title="Archive">Archive</button>`
            ) : ''}
            ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="window.CUSTOMER_SCREEN._delete(${c.id}, '${this._escapeAttr(c.name)}')" title="Delete">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  },

  _renderPagination() {
    const p = this._pagination;
    if (!p || p.totalPages <= 1) return '';
    return `
      <div class="pagination">
        <span class="pagination-info">${p.total} customers — Page ${p.page} of ${p.totalPages}</span>
        <div class="pagination-btns">
          <button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._goPage(1)" ${p.page <= 1 ? 'disabled' : ''}>First</button>
          <button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._goPage(${p.page - 1})" ${!p.hasPrev ? 'disabled' : ''}>Prev</button>
          <button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._goPage(${p.page + 1})" ${!p.hasNext ? 'disabled' : ''}>Next</button>
          <button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._goPage(${p.totalPages})" ${p.page >= p.totalPages ? 'disabled' : ''}>Last</button>
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const safeLoad = () => this._load().catch(e => console.error('Customer load error:', e));
    document.getElementById('customer-realign-queue-btn')?.addEventListener('click', () => {
      this._showRealignModal();
    });
    document.getElementById('customer-search-btn')?.addEventListener('click', () => this._doSearch());
    document.getElementById('customer-search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doSearch(); });
    document.getElementById('customer-clear-btn')?.addEventListener('click', () => { this._searchTerm = ''; this._currentPage = 1; safeLoad(); });

    document.getElementById('filter-sort-queue')?.addEventListener('change', e => {
      const val = e.target.value;
      if (val === 'created_at_desc') { this._sortColumn = 'created_at'; this._sortDirection = 'DESC'; }
      else if (val === 'created_at_asc') { this._sortColumn = 'created_at'; this._sortDirection = 'ASC'; }
      else if (val === 'name_asc') { this._sortColumn = 'name'; this._sortDirection = 'ASC'; }
      else if (val === 'name_desc') { this._sortColumn = 'name'; this._sortDirection = 'DESC'; }
      else if (val === 'city_asc') { this._sortColumn = 'city'; this._sortDirection = 'ASC'; }
      else if (val === 'customer_id_asc') { this._sortColumn = 'customer_id'; this._sortDirection = 'ASC'; }
      this._currentPage = 1;
      safeLoad();
    });

    document.getElementById('filter-city')?.addEventListener('change', e => { this._filterCity = e.target.value; this._currentPage = 1; safeLoad(); });
    document.getElementById('filter-membership')?.addEventListener('change', e => { this._filterMembership = e.target.value; this._currentPage = 1; safeLoad(); });
    document.getElementById('filter-archived')?.addEventListener('change', e => { this._filterArchived = e.target.value; this._currentPage = 1; safeLoad(); });
    document.getElementById('filter-pagesize')?.addEventListener('change', e => { this._pageSize = parseInt(e.target.value, 10) || 50; this._currentPage = 1; safeLoad(); });
  },

  _showRealignModal() {
    const container = document.getElementById('customer-modal-container');
    if (!container) return;
    container.innerHTML = `
      <div class="modal-overlay" id="realign-modal-overlay">
        <div class="modal" style="max-width:500px;width:95%;">
          <div class="modal-header">
            <h3>⚡ 1-Click Customer Queue Alignment</h3>
            <button class="modal-close" id="realign-modal-close">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <p style="margin-bottom:14px;color:var(--text-secondary);font-size:13.5px;line-height:1.5;">
              This will re-assign sequential Customer IDs (<strong>CUST-0001, CUST-0002...</strong>) to all customers based on your chosen queue sequence.
              <br><span style="color:var(--success);font-weight:600;">All ledger entries, bills, and phone numbers remain completely safe and linked.</span>
            </p>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:600;margin-bottom:8px;">Choose Queue Order (क्रम प्रकार चुनें):</label>
              <div style="display:flex;flex-direction:column;gap:10px;">
                <label style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--bg-card);">
                  <input type="radio" name="realign-order" value="date_asc" checked style="width:16px;height:16px;">
                  <div>
                    <div style="font-weight:600;">📅 Date Wise (तारीख / एंट्री अनुसार)</div>
                    <div style="font-size:12px;color:var(--text-muted);">Oldest customer gets CUST-0001, in original order of entry</div>
                  </div>
                </label>
                <label style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--bg-card);">
                  <input type="radio" name="realign-order" value="name_asc" style="width:16px;height:16px;">
                  <div>
                    <div style="font-weight:600;">🔤 Name A to Z (नामानुसार A-Z)</div>
                    <div style="font-size:12px;color:var(--text-muted);">Alphabetical sequence: Amit, Bharat, Chetan...</div>
                  </div>
                </label>
                <label style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--bg-card);">
                  <input type="radio" name="realign-order" value="city_asc" style="width:16px;height:16px;">
                  <div>
                    <div style="font-weight:600;">📍 Place / Village Name (गाव / शहर अनुसार)</div>
                    <div style="font-size:12px;color:var(--text-muted);">Grouped by Village/City name A-Z, then customer name</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--border);">
            <button type="button" class="btn btn-secondary" id="realign-modal-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="realign-modal-confirm">Apply & Re-align Queue</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { container.innerHTML = ''; };
    document.getElementById('realign-modal-close')?.addEventListener('click', close);
    document.getElementById('realign-modal-cancel')?.addEventListener('click', close);
    document.getElementById('realign-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'realign-modal-overlay') close();
    });

    document.getElementById('realign-modal-confirm')?.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="realign-order"]:checked')?.value || 'date_asc';
      const confirmBtn = document.getElementById('realign-modal-confirm');
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳ Aligning Queue...'; }
      try {
        const res = await API.invoke('customer:realignQueue', { sortBy: selected });
        close();
        this._showToast(`⚡ 1-Click Queue: ${res.count} customers re-aligned!`, 'success');
        this._load().catch(() => {});
      } catch (err) {
        alert('Error: ' + err.message);
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Apply & Re-align Queue'; }
      }
    });
  },

  _doSearch() {
    this._searchTerm = document.getElementById('customer-search-input')?.value?.trim() || '';
    this._currentPage = 1;
    this._load().catch(e => console.error('Customer search error:', e));
  },

  _toggleSort(col) {
    if (this._sortColumn === col) {
      this._sortDirection = this._sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this._sortColumn = col;
      this._sortDirection = 'ASC';
    }
    this._currentPage = 1;
    this._load().catch(e => console.error('Customer sort error:', e));
  },

  _sortIcon(col) {
    if (this._sortColumn !== col) return '';
    return this._sortDirection === 'ASC' ? ' ▲' : ' ▼';
  },

  _goPage(page) {
    this._currentPage = page;
    this._load().catch(e => console.error('Customer pagination error:', e));
  },

  _showDetail(id) {
    this._detailCustomer = null;
    const container = document.getElementById('customer-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="detail-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2>Customer Details</h2>
            <button class="modal-close" id="detail-modal-close">&times;</button>
          </div>
          <div class="modal-body" id="detail-body">
            <div class="loading"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('detail-modal-close').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'detail-modal') container.innerHTML = ''; });
    this._loadDetail(id);
  },

  async _loadDetail(id) {
    try {
      const [customer, summary] = await Promise.all([
        API.invoke('customer:getById', { id }),
        API.invoke('customer:getSummary', { id })
      ]);
      this._detailCustomer = customer;
      this._renderDetail(customer, summary);
    } catch (err) {
      document.getElementById('detail-body').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
    }
  },

  _renderDetail(c, s) {
    const body = document.getElementById('detail-body');
    if (!body) return;
    const memberName = this._membershipLevels.find(m => m.id === c.membership_level_id)?.name || 'None';
    const created = c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '';
    const canEdit = APP_STATE.hasPermission('customer.edit');

    body.innerHTML = `
      <div class="detail-header">
        <div class="detail-avatar">${(c.name || 'U').charAt(0).toUpperCase()}</div>
        <div class="detail-title">
          <h3>${this._escape(c.name)}</h3>
          <span class="text-muted">${this._escape(c.customer_id)}</span>
          ${c.is_archived ? '<span class="badge badge-inactive" style="margin-left:8px">Archived</span>' : ''}
        </div>
        <div class="detail-actions">
          ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="window.CUSTOMER_SCREEN._showEdit(${c.id})">Edit</button>` : ''}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-section">
          <h4>Contact Information</h4>
          <div class="detail-field"><span class="detail-label">Relation</span><span>${this._escape(c.relation || '-')}</span></div>
          <div class="detail-field"><span class="detail-label">Phone 1</span><span>${this._escape(c.phone1 || '-')}</span></div>
          <div class="detail-field"><span class="detail-label">Phone 2</span><span>${this._escape(c.phone2 || '-')}</span></div>
          <div class="detail-field"><span class="detail-label">Address</span><span>${this._escape(c.address || '-')}</span></div>
          <div class="detail-field"><span class="detail-label">City</span><span>${this._escape(c.city || '-')}</span></div>
        </div>
        <div class="detail-section">
          <h4>Classification</h4>
          <div class="detail-field"><span class="detail-label">Membership</span><span>${this._escape(memberName)}</span></div>
          <div class="detail-field"><span class="detail-label">Aadhaar</span><span>${c.aadhaar_number || '-'}</span></div>
          <div class="detail-field"><span class="detail-label">Notes</span><span>${this._escape(c.notes || '-')}</span></div>
          <div class="detail-field"><span class="detail-label">Customer Since</span><span>${created}</span></div>
          <div class="detail-field"><span class="detail-label">Source</span><span>${this._escape(c.data_source || 'live')}</span></div>
        </div>
      </div>

      <div class="detail-stats">
        <div class="stat-card"><div class="stat-value">${s.total_bills || 0}</div><div class="stat-label">Total Bills</div></div>
        <div class="stat-card"><div class="stat-value">${this._fmtCurrency(s.total_purchases)}</div><div class="stat-label">Total Purchases</div></div>
        <div class="stat-card"><div class="stat-value">${this._fmtCurrency(s.total_paid)}</div><div class="stat-label">Total Paid</div></div>
        <div class="stat-card"><div class="stat-value" style="color:${(s.total_pending || 0) > 0 ? 'var(--danger)' : 'var(--success)'}">${this._fmtCurrency(s.total_pending)}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card"><div class="stat-value" style="color:${(s.khata_balance || 0) > 0 ? 'var(--danger)' : 'var(--success)'}">${this._fmtCurrency(s.khata_balance)}</div><div class="stat-label">Khata Balance</div></div>
        <div class="stat-card"><div class="stat-value">${s.last_purchase_date ? new Date(s.last_purchase_date).toLocaleDateString('en-IN') : 'N/A'}</div><div class="stat-label">Last Purchase</div></div>
      </div>

      <div class="detail-placeholder-sections">
        <div class="placeholder-section">
          <h4>Purchase History</h4>
          <p class="text-muted">Purchase history will be available once the Billing module is integrated.</p>
        </div>
        <div class="placeholder-section">
          <h4>Khata / Ledger</h4>
          <p class="text-muted">Khata ledger will be available once the Khata module is integrated.</p>
        </div>
        <div class="placeholder-section">
          <h4>Communication</h4>
          <p class="text-muted">WhatsApp and SMS communication will be available in a future update.</p>
        </div>
      </div>
    `;
  },

  _showEdit(id) {
    const customer = this._customers.find(c => c.id === id) || this._detailCustomer;
    if (customer) this._showFormModal('Edit Customer', customer);
  },

  _showFormModal(title, customer) {
    const isEdit = !!customer;
    const container = document.getElementById('customer-modal-container');

    container.innerHTML = `
      <div class="modal-overlay" id="customer-form-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close" id="customer-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="customer-form-alert"></div>
            <form id="customer-form" onsubmit="return false">
              <div class="form-group">
                <label for="cust-customer-id">Customer ID ${isEdit ? '' : '<span class="text-muted">(leave empty for auto-generate)</span>'}</label>
                <input type="text" id="cust-customer-id" class="form-control" placeholder="e.g. CUST-0001" value="${isEdit ? this._escape(customer.customer_id) : ''}">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="cust-name">Name *</label>
                  <input type="text" id="cust-name" class="form-control" value="${isEdit ? this._escape(customer.name) : ''}" ${isEdit ? '' : 'autofocus'}>
                </div>
                <div class="form-group">
                  <label for="cust-relation">Relation (पिता / पति / रिश्तेदार)</label>
                  <input type="text" id="cust-relation" class="form-control" placeholder="e.g. S/o Ramesh / W/o Suresh" value="${isEdit ? this._escape(customer.relation || '') : ''}">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="cust-phone1">Phone 1</label>
                  <input type="tel" id="cust-phone1" class="form-control" placeholder="10-digit mobile" value="${isEdit ? this._escape(customer.phone1 || '') : ''}">
                </div>
                <div class="form-group">
                  <label for="cust-phone2">Phone 2</label>
                  <input type="tel" id="cust-phone2" class="form-control" placeholder="Alternate phone" value="${isEdit ? this._escape(customer.phone2 || '') : ''}">
                </div>
              </div>
              <div class="form-group">
                <label for="cust-city">City</label>
                <input type="text" id="cust-city" class="form-control" value="${isEdit ? this._escape(customer.city || '') : ''}">
              </div>
              <div class="form-group">
                <label for="cust-address">Address</label>
                <textarea id="cust-address" class="form-control" rows="2">${isEdit ? this._escape(customer.address || '') : ''}</textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="cust-aadhaar">Aadhaar Number</label>
                  <input type="text" id="cust-aadhaar" class="form-control" placeholder="12-digit Aadhaar" value="${isEdit && customer.aadhaar_number && customer.aadhaar_number !== '********' ? customer.aadhaar_number : ''}">
                </div>
                <div class="form-group">
                  <label for="cust-membership">Membership Level</label>
                  <select id="cust-membership" class="form-control">
                    <option value="">None</option>
                    ${this._membershipLevels.map(m => `<option value="${m.id}" ${isEdit && customer.membership_level_id === m.id ? 'selected' : ''}>${this._escape(m.name)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label for="cust-notes">Notes</label>
                <textarea id="cust-notes" class="form-control" rows="2">${isEdit ? this._escape(customer.notes || '') : ''}</textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="customer-form-cancel">Cancel</button>
            <button class="btn btn-primary" id="customer-form-save">${isEdit ? 'Save Changes' : 'Add Customer'}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('customer-modal-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('customer-form-cancel').addEventListener('click', () => container.innerHTML = '');

    document.getElementById('customer-form-save').addEventListener('click', async () => {
      if (isEdit) {
        await this._saveEdit(customer.id);
      } else {
        await this._saveCreate();
      }
    });

    container.addEventListener('click', e => {
      if (e.target.id === 'customer-form-modal') container.innerHTML = '';
    });
  },

  async _saveCreate() {
    const data = this._collectFormData();
    if (!data) return;

    const btn = document.getElementById('customer-form-save');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      await API.invoke('customer:create', data);
      document.getElementById('customer-modal-container').innerHTML = '';
      this._showToast('Customer created successfully', 'success');
      if (this._pagination) this._currentPage = 1;
      window.dispatchEvent(new CustomEvent('customer-changed'));
      this._load();
    } catch (err) {
      this._showFormError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Customer';
    }
  },

  async _saveEdit(id) {
    const data = this._collectFormData();
    if (!data) return;

    const btn = document.getElementById('customer-form-save');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await API.invoke('customer:update', { id, data });
      document.getElementById('customer-modal-container').innerHTML = '';
      this._showToast('Customer updated successfully', 'success');
      window.dispatchEvent(new CustomEvent('customer-changed'));
      this._load();
    } catch (err) {
      this._showFormError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  },

  _collectFormData() {
    const name = document.getElementById('cust-name').value.trim();
    if (!name) { this._showFormError('Name is required'); return null; }

    const phone1 = document.getElementById('cust-phone1')?.value.trim() || undefined;

    const data = {
      name,
      relation: document.getElementById('cust-relation')?.value.trim() || undefined,
      phone1: phone1 || undefined,
      phone2: document.getElementById('cust-phone2')?.value.trim() || undefined,
      city: document.getElementById('cust-city')?.value.trim() || undefined,
      address: document.getElementById('cust-address')?.value.trim() || undefined,
      aadhaar_number: document.getElementById('cust-aadhaar')?.value.trim() || undefined,
      notes: document.getElementById('cust-notes')?.value.trim() || undefined,
      membership_level_id: document.getElementById('cust-membership')?.value || undefined
    };

    const customerId = document.getElementById('cust-customer-id')?.value.trim();
    if (customerId) {
      data.customer_id = customerId;
    }

    return data;
  },

  async _archive(id) {
    if (!confirm('Archive this customer? They will be hidden from most views but their history will be preserved.')) return;
    try {
      await API.invoke('customer:archive', { id });
      this._showToast('Customer archived', 'success');
      window.dispatchEvent(new CustomEvent('customer-changed'));
      this._load();
    } catch (err) {
      this._showToast(err.message, 'error');
    }
  },

  async _unarchive(id) {
    try {
      await API.invoke('customer:unarchive', { id });
      this._showToast('Customer unarchived', 'success');
      window.dispatchEvent(new CustomEvent('customer-changed'));
      this._load();
    } catch (err) {
      this._showToast(err.message, 'error');
    }
  },

  async _delete(id, name) {
    if (!confirm(`Permanently delete "${name}"? This action cannot be undone.`)) return;
    try {
      await API.invoke('customer:delete', { id });
      this._showToast('Customer deleted', 'success');
      window.dispatchEvent(new CustomEvent('customer-changed'));
      this._load();
    } catch (err) {
      this._showToast(err.message, 'error');
    }
  },

  _fmtCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0.00';
    return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  _showFormError(msg) {
    const el = document.getElementById('customer-form-alert');
    if (el) el.innerHTML = `<div class="alert alert-error">${this._escape(msg)}</div>`;
  },

  _showToast(msg, type = 'info') {
    if (typeof Toast !== 'undefined') Toast.show(msg, type);
  },

  async _exportCSV() {
    try {
      const allCustomers = await API.invoke('customer:search', { pageSize: 10000 });
      const list = allCustomers.data || [];
      if (!list.length) { Toast.show('No customers to export', 'info'); return; }
      const header = 'Customer ID,Name,Phone 1,Phone 2,City,Email,Balance,Membership,Created';
      const rows = list.map(c =>
        `"${(c.customer_id || '')}","${(c.name || '').replace(/"/g, '""')}","${(c.phone1 || '')}","${(c.phone2 || '')}","${(c.city || '').replace(/"/g, '""')}","${(c.email || '')}","${c.khata_balance || 0}","${(c.membership_name || '')}","${(c.created_at || '')}"`
      );
      this._downloadCSV([header, ...rows].join('\n'), 'customers_export.csv');
      Toast.success('Customer CSV exported');
    } catch (err) { Toast.error('Export failed: ' + err.message); }
  },

  _downloadCSV(content, filename) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _escapeAttr(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }
};
window.CUSTOMER_SCREEN = CUSTOMER_SCREEN;