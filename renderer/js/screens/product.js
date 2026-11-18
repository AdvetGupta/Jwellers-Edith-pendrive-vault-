const PRODUCT_SCREEN = {
  _products: [],
  _pagination: null,
  _searchTerm: '',
  _filterMetal: '',
  _filterStatus: 'active',
  _sortColumn: 'product_name',
  _sortDirection: 'ASC',
  _currentPage: 1,

  async render() {
    return `
      <div class="product-page">
        <div class="page-header">
          <div>
            <h2>Inventory & Stock</h2>
            <p class="text-muted" style="font-size:13px; margin-top:2px;">Manage jewellery items, metal purity, weights in grams, and quantity in pieces.</p>
          </div>
          <div class="page-header-actions">
            ${APP_STATE.hasPermission('product.create') ? '<button class="btn btn-primary" id="product-add-btn">+ Add Product</button>' : ''}
          </div>
        </div>
        <div id="product-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div id="product-modal-container"></div>
      </div>
    `;
  },

  async init() {
    await this._load();
    document.getElementById('product-add-btn')?.addEventListener('click', () => this._showFormModal('Add Product', null));
  },

  async _load() {
    try {
      const params = {
        page: this._currentPage,
        pageSize: 20,
        sortColumn: this._sortColumn,
        sortDirection: this._sortDirection
      };
      if (this._searchTerm) params.search = this._searchTerm;
      if (this._filterStatus === 'active') params.is_active = true;
      else if (this._filterStatus === 'inactive') params.is_active = false;

      const result = await API.invoke('product:search', params);
      let list = result.data || [];
      if (this._filterMetal) {
        list = list.filter(p => (p.metal || '').toLowerCase() === this._filterMetal.toLowerCase());
      }
      this._products = list;
      this._pagination = result.pagination;
      this._renderList();
    } catch (err) {
      document.getElementById('product-content').innerHTML = `<div class="alert alert-error">Failed to load products: ${this._escape(err.message)}</div>`;
    }
  },

  _renderList() {
    const container = document.getElementById('product-content');
    if (!container) return;

    container.innerHTML = `
      <div class="product-filters">
        <div class="product-search">
          <input type="text" id="product-search-input" class="form-control" placeholder="Search by product name, HSN, metal..." value="${this._escape(this._searchTerm)}">
          <button class="btn btn-primary" id="product-search-btn">Search</button>
          ${this._searchTerm ? '<button class="btn btn-secondary" id="product-clear-btn">Clear</button>' : ''}
        </div>
        <div class="product-filter-row">
          <select id="filter-metal" class="form-control filter-select">
            <option value="">All Metals</option>
            <option value="Gold" ${this._filterMetal.toLowerCase() === 'gold' ? 'selected' : ''}>Gold (सोना)</option>
            <option value="Silver" ${this._filterMetal.toLowerCase() === 'silver' ? 'selected' : ''}>Silver (चांदी)</option>
            <option value="Platinum" ${this._filterMetal.toLowerCase() === 'platinum' ? 'selected' : ''}>Platinum</option>
            <option value="Diamond" ${this._filterMetal.toLowerCase() === 'diamond' ? 'selected' : ''}>Diamond</option>
            <option value="Mix" ${this._filterMetal.toLowerCase() === 'mix' ? 'selected' : ''}>Mix / Both</option>
          </select>
          <select id="filter-status" class="form-control filter-select">
            <option value="active" ${this._filterStatus === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${this._filterStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
            <option value="all" ${this._filterStatus === 'all' ? 'selected' : ''}>All</option>
          </select>
        </div>
      </div>
      <div class="product-table-wrapper">
        <table class="data-table product-table">
          <thead>
            <tr>
              <th class="sortable" data-col="product_name" onclick="window.PRODUCT_SCREEN._toggleSort('product_name')">Product ${this._sortIcon('product_name')}</th>
              <th>Metal</th>
              <th>Purity</th>
              <th>Gross Wt (gm)</th>
              <th>Net Wt (gm)</th>
              <th class="sortable" data-col="quantity_in_stock" onclick="window.PRODUCT_SCREEN._toggleSort('quantity_in_stock')">Pieces (Qty) ${this._sortIcon('quantity_in_stock')}</th>
              <th>Purchase Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this._products.length === 0 ? '<tr><td colspan="9" class="table-empty">No inventory items found</td></tr>' : ''}
            ${this._products.map(p => this._renderRow(p)).join('')}
          </tbody>
        </table>
      </div>
      ${this._renderPagination()}
    `;

    this._bindEvents();
  },

  _renderRow(p) {
    const isActive = !!p.is_active;
    const qty = p.quantity_in_stock != null ? p.quantity_in_stock : 0;
    const lowStock = qty <= 2 && qty > 0;
    const outOfStock = qty <= 0;
    const canEdit = APP_STATE.hasPermission('product.edit');
    const canDelete = APP_STATE.hasPermission('product.delete');
    const canAdjust = APP_STATE.hasPermission('inventory.adjust');

    return `
      <tr class="${!isActive ? 'row-inactive' : ''}">
        <td><a class="product-name-link" onclick="window.PRODUCT_SCREEN._showDetail(${p.id})"><strong>${this._escape(p.product_name)}</strong></a></td>
        <td><span class="badge" style="background:var(--bg-body);font-weight:700;">${this._escape(p.metal || 'Gold')}</span></td>
        <td>${this._escape(p.purity || '-')}</td>
        <td>${p.gross_weight ? `${Number(p.gross_weight).toFixed(3)} gm` : '-'}</td>
        <td>${p.net_weight ? `<strong>${Number(p.net_weight).toFixed(3)} gm</strong>` : '-'}</td>
        <td>
          <span class="stock-badge ${outOfStock ? 'stock-out' : lowStock ? 'stock-low' : 'stock-ok'}">
            ${qty} Pcs
          </span>
        </td>
        <td>${p.purchase_price ? this._fmtCurrency(p.purchase_price) : '-'}</td>
        <td>${isActive ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}</td>
        <td>
          <div class="cell-actions">
            <button class="btn btn-sm btn-secondary" onclick="window.PRODUCT_SCREEN._showDetail(${p.id})" title="View">View</button>
            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="window.PRODUCT_SCREEN._showEdit(${p.id})" title="Edit">Edit</button>` : ''}
            ${canAdjust ? `<button class="btn btn-sm btn-secondary" onclick="window.PRODUCT_SCREEN._showAdjust(${p.id})" title="Adjust Pieces">Pieces</button>` : ''}
            ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="window.PRODUCT_SCREEN._delete(${p.id}, '${this._escapeAttr(p.product_name)}')" title="Delete">Del</button>` : ''}
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
        <span class="pagination-info">${p.total} products — Page ${p.page} of ${p.totalPages}</span>
        <div class="pagination-btns">
          <button class="btn btn-sm btn-secondary" onclick="window.PRODUCT_SCREEN._goPage(1)" ${p.page <= 1 ? 'disabled' : ''}>First</button>
          <button class="btn btn-sm btn-secondary" onclick="window.PRODUCT_SCREEN._goPage(${p.page - 1})" ${!p.hasPrev ? 'disabled' : ''}>Prev</button>
          <button class="btn btn-sm btn-secondary" onclick="window.PRODUCT_SCREEN._goPage(${p.page + 1})" ${!p.hasNext ? 'disabled' : ''}>Next</button>
          <button class="btn btn-sm btn-secondary" onclick="window.PRODUCT_SCREEN._goPage(${p.totalPages})" ${p.page >= p.totalPages ? 'disabled' : ''}>Last</button>
        </div>
      </div>
    `;
  },

  _bindEvents() {
    const safeLoad = () => this._load().catch(e => console.error('Product load error:', e));
    document.getElementById('product-search-btn')?.addEventListener('click', () => this._doSearch());
    document.getElementById('product-search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doSearch(); });
    document.getElementById('product-clear-btn')?.addEventListener('click', () => { this._searchTerm = ''; this._currentPage = 1; safeLoad(); });

    document.getElementById('filter-metal')?.addEventListener('change', e => { this._filterMetal = e.target.value; this._currentPage = 1; safeLoad(); });
    document.getElementById('filter-status')?.addEventListener('change', e => { this._filterStatus = e.target.value; this._currentPage = 1; safeLoad(); });
  },

  _doSearch() {
    this._searchTerm = document.getElementById('product-search-input')?.value?.trim() || '';
    this._currentPage = 1;
    this._load().catch(e => console.error('Product search error:', e));
  },

  _toggleSort(col) {
    if (this._sortColumn === col) {
      this._sortDirection = this._sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this._sortColumn = col;
      this._sortDirection = 'ASC';
    }
    this._currentPage = 1;
    this._load();
  },

  _sortIcon(col) {
    if (this._sortColumn !== col) return '';
    return this._sortDirection === 'ASC' ? ' ▲' : ' ▼';
  },

  _goPage(page) {
    this._currentPage = page;
    this._load();
  },

  _showDetail(id) {
    const container = document.getElementById('product-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="detail-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2>Product Details</h2>
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
      const product = await API.invoke('product:getById', { id });
      const movements = await API.invoke('inventory:getMovements', { productId: id });
      this._renderDetail(product, movements || []);
    } catch (err) {
      document.getElementById('detail-body').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
    }
  },

  _renderDetail(p, movements) {
    const body = document.getElementById('detail-body');
    if (!body) return;
    const canEdit = APP_STATE.hasPermission('product.edit');
    const canAdjust = APP_STATE.hasPermission('inventory.adjust');

    body.innerHTML = `
      <div class="detail-header">
        <div class="detail-avatar" style="background:var(--primary-dark)">${(p.product_name || 'P').charAt(0).toUpperCase()}</div>
        <div class="detail-title">
          <h3>${this._escape(p.product_name)}</h3>
          <div class="detail-meta">
            ${p.metal ? `<span class="badge">${this._escape(p.metal)}</span>` : ''}
            ${p.purity ? `<span class="badge">${this._escape(p.purity)}</span>` : ''}
            ${p.is_active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}
          </div>
        </div>
        <div class="detail-actions">
          ${canEdit ? `<button class="btn btn-secondary" onclick="window.PRODUCT_SCREEN._showEdit(${p.id})">Edit</button>` : ''}
          ${canAdjust ? `<button class="btn btn-secondary" onclick="window.PRODUCT_SCREEN._showAdjust(${p.id})">Adjust Pieces</button>` : ''}
        </div>
      </div>

      <div class="detail-grid" style="margin-top:16px;">
        <div class="detail-field">
          <label>HSN Code</label>
          <div>${this._escape(p.hsn_code || '-')}</div>
        </div>
        <div class="detail-field">
          <label>Metal</label>
          <div>${this._escape(p.metal || 'Gold')}</div>
        </div>
        <div class="detail-field">
          <label>Purity</label>
          <div>${this._escape(p.purity || '-')}</div>
        </div>
        <div class="detail-field">
          <label>Gross Weight</label>
          <div>${p.gross_weight ? `${p.gross_weight} gm` : '-'}</div>
        </div>
        <div class="detail-field">
          <label>Net Weight</label>
          <div>${p.net_weight ? `<strong>${p.net_weight} gm</strong>` : '-'}</div>
        </div>
        <div class="detail-field">
          <label>Stone Weight</label>
          <div>${p.stone_weight ? `${p.stone_weight} gm (${p.stone_type || 'Stone'})` : '-'}</div>
        </div>
        <div class="detail-field">
          <label>Purchase Price</label>
          <div>${p.purchase_price ? this._fmtCurrency(p.purchase_price) : '-'}</div>
        </div>
        <div class="detail-field">
          <label>Available Pieces</label>
          <div><strong style="color:var(--primary); font-size:16px;">${p.quantity_in_stock || 0} Pcs</strong></div>
        </div>
      </div>

      ${p.description ? `
      <div style="margin-top:16px; padding:12px; background:var(--bg-body); border-radius:var(--radius);">
        <label style="font-weight:600; font-size:12px; color:var(--text-muted);">Description / Notes</label>
        <p style="margin-top:4px;">${this._escape(p.description)}</p>
      </div>` : ''}

      <div style="margin-top:24px;">
        <h4>Stock Movements History (Pieces)</h4>
        ${movements.length === 0 ? '<p class="text-muted" style="margin-top:8px">No stock movements recorded.</p>' : `
        <table class="data-table" style="margin-top:8px">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Before</th>
              <th>Change</th>
              <th>After</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => `
              <tr>
                <td class="text-muted">${m.created_at ? new Date(m.created_at).toLocaleString('en-IN') : ''}</td>
                <td><span class="movement-type movement-${m.movement_type}">${this._escape(m.movement_type.replace(/_/g, ' '))}</span></td>
                <td>${m.quantity_before} Pcs</td>
                <td style="color:${m.quantity_change >= 0 ? 'var(--success)' : 'var(--danger)'}">${m.quantity_change >= 0 ? '+' : ''}${m.quantity_change} Pcs</td>
                <td><strong>${m.quantity_after} Pcs</strong></td>
                <td class="text-muted">${this._escape(m.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;
  },

  _showEdit(id) {
    const product = this._products.find(p => p.id === id);
    if (product) this._showFormModal('Edit Product', product);
  },

  _showFormModal(title, product) {
    const isEdit = !!product;
    const container = document.getElementById('product-modal-container');

    container.innerHTML = `
      <div class="modal-overlay" id="product-form-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close" id="product-modal-close">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px 24px;">
            <div id="product-form-alert"></div>
            <form id="product-form" onsubmit="return false">
              <div class="form-row">
                <div class="form-group" style="flex:2">
                  <label for="prod-name">Product Name *</label>
                  <input type="text" id="prod-name" class="form-control" placeholder="e.g. Gold Ring 22K, Silver Payal" value="${isEdit ? this._escape(product.product_name) : ''}" ${isEdit ? '' : 'autofocus'}>
                </div>
                <div class="form-group">
                  <label for="prod-hsn">HSN Code</label>
                  <input type="text" id="prod-hsn" class="form-control" placeholder="e.g. 7113" value="${isEdit ? this._escape(product.hsn_code || '') : ''}">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="prod-metal">Metal (धातु) *</label>
                  <select id="prod-metal" class="form-control">
                    <option value="Gold" ${isEdit && (product.metal || '').toLowerCase() === 'gold' ? 'selected' : ''}>Gold (सोना)</option>
                    <option value="Silver" ${isEdit && (product.metal || '').toLowerCase() === 'silver' ? 'selected' : ''}>Silver (चांदी)</option>
                    <option value="Platinum" ${isEdit && (product.metal || '').toLowerCase() === 'platinum' ? 'selected' : ''}>Platinum</option>
                    <option value="Diamond" ${isEdit && (product.metal || '').toLowerCase() === 'diamond' ? 'selected' : ''}>Diamond (हीरा)</option>
                    <option value="Mix" ${isEdit && (product.metal || '').toLowerCase() === 'mix' ? 'selected' : ''}>Mix / Both</option>
                    <option value="Other" ${isEdit && (product.metal || '').toLowerCase() === 'other' ? 'selected' : ''}>Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="prod-purity">Purity (शुद्धता)</label>
                  <input type="text" id="prod-purity" class="form-control" placeholder="e.g. 22K (916), 18K (750), 92.5% Silver" value="${isEdit ? this._escape(product.purity || '') : ''}">
                </div>
              </div>

              <div class="form-row form-row-3">
                <div class="form-group">
                  <label for="prod-gross">Gross Weight (gm) (सकल वजन)</label>
                  <input type="number" id="prod-gross" class="form-control" step="0.001" min="0" placeholder="0.000" value="${isEdit && product.gross_weight != null ? product.gross_weight : ''}">
                </div>
                <div class="form-group">
                  <label for="prod-net">Net Weight (gm) (शुद्ध वजन)</label>
                  <input type="number" id="prod-net" class="form-control" step="0.001" min="0" placeholder="0.000" value="${isEdit && product.net_weight != null ? product.net_weight : ''}">
                </div>
                <div class="form-group">
                  <label for="prod-stone-wt">Stone Weight (gm)</label>
                  <input type="number" id="prod-stone-wt" class="form-control" step="0.001" min="0" placeholder="0.000" value="${isEdit && product.stone_weight != null ? product.stone_weight : ''}">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="prod-stone-type">Stone Type</label>
                  <input type="text" id="prod-stone-type" class="form-control" placeholder="e.g. Diamond, CZ, Pearl" value="${isEdit ? this._escape(product.stone_type || '') : ''}">
                </div>
                <div class="form-group">
                  <label for="prod-purchase-price">Purchase Price (₹)</label>
                  <input type="number" id="prod-purchase-price" class="form-control" step="0.01" min="0" placeholder="0.00" value="${isEdit && product.purchase_price != null ? product.purchase_price : ''}">
                </div>
              </div>

              ${!isEdit ? `
              <div class="form-group">
                <label for="prod-qty">Number of Pieces (कुल पीस / Quantity) *</label>
                <input type="number" id="prod-qty" class="form-control" step="1" min="0" value="1" placeholder="1">
              </div>
              ` : ''}

              <div class="form-group">
                <label for="prod-desc">Description / Item Remarks</label>
                <textarea id="prod-desc" class="form-control" rows="2" placeholder="Optional notes or batch details...">${isEdit ? this._escape(product.description || '') : ''}</textarea>
              </div>

              ${isEdit ? `
              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="prod-active" ${product.is_active ? 'checked' : ''}>
                  <span>Active Item</span>
                </label>
              </div>
              ` : ''}
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="product-form-cancel">Cancel</button>
            <button class="btn btn-primary" id="product-form-save">${isEdit ? 'Save Changes' : 'Add Product'}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('product-modal-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('product-form-cancel').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('product-form-save').addEventListener('click', async () => {
      if (isEdit) await this._saveEdit(product.id);
      else await this._saveCreate();
    });
    container.addEventListener('click', e => { if (e.target.id === 'product-form-modal') container.innerHTML = ''; });
  },

  async _saveCreate() {
    const data = this._collectFormData();
    if (!data) return;

    const btn = document.getElementById('product-form-save');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      data.quantity_in_stock = parseFloat(document.getElementById('prod-qty')?.value) || 1;
      await API.invoke('product:create', data);
      document.getElementById('product-modal-container').innerHTML = '';
      this._showToast('Product created successfully', 'success');
      if (this._pagination) this._currentPage = 1;
      this._load();
    } catch (err) {
      this._showFormError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Product';
    }
  },

  async _saveEdit(id) {
    const data = this._collectFormData();
    if (!data) return;

    data.is_active = document.getElementById('prod-active')?.checked;

    const btn = document.getElementById('product-form-save');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await API.invoke('product:update', { id, data });
      document.getElementById('product-modal-container').innerHTML = '';
      this._showToast('Product updated successfully', 'success');
      this._load();
    } catch (err) {
      this._showFormError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  },

  _collectFormData() {
    const name = document.getElementById('prod-name').value.trim();
    if (!name) { this._showFormError('Product name is required'); return null; }

    return {
      product_name: name,
      metal: document.getElementById('prod-metal').value.trim() || 'Gold',
      purity: document.getElementById('prod-purity').value.trim() || undefined,
      gross_weight: document.getElementById('prod-gross').value || undefined,
      net_weight: document.getElementById('prod-net').value || undefined,
      unit: 'gms',
      stone_weight: document.getElementById('prod-stone-wt').value || undefined,
      stone_type: document.getElementById('prod-stone-type').value.trim() || undefined,
      purchase_price: document.getElementById('prod-purchase-price').value || undefined,
      description: document.getElementById('prod-desc').value.trim() || undefined,
      hsn_code: document.getElementById('prod-hsn').value.trim() || undefined
    };
  },

  _showAdjust(id) {
    const product = this._products.find(p => p.id === id);
    if (!product) return;

    const container = document.getElementById('product-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="adjust-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Adjust Pieces (Stock)</h2>
            <button class="modal-close" id="adjust-modal-close">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px 24px;">
            <div id="adjust-alert"></div>
            <p style="margin-bottom:16px"><strong>${this._escape(product.product_name)}</strong> — Current stock: <strong style="color:var(--primary); font-size:16px;">${product.quantity_in_stock || 0} Pcs</strong></p>
            <form id="adjust-form" onsubmit="return false">
              <div class="form-row">
                <div class="form-group">
                  <label for="adj-type">Movement Type</label>
                  <select id="adj-type" class="form-control">
                    <option value="addition">Addition (+ Pieces)</option>
                    <option value="reduction">Reduction (- Pieces)</option>
                    <option value="physical_count">Physical Count (Set Exact Pieces)</option>
                    <option value="damage">Damaged / Melted (- Pieces)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="adj-qty">Number of Pieces</label>
                  <input type="number" id="adj-qty" class="form-control" step="1" min="0" placeholder="1" autofocus>
                </div>
              </div>
              <div class="form-group">
                <label for="adj-notes">Reason / Notes</label>
                <input type="text" id="adj-notes" class="form-control" placeholder="e.g. New stock arrival, counter verification">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="adjust-cancel">Cancel</button>
            <button class="btn btn-primary" id="adjust-save">Apply Adjustment</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('adjust-modal-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('adjust-cancel').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('adjust-save').addEventListener('click', async () => {
      const type = document.getElementById('adj-type').value;
      const qty = parseFloat(document.getElementById('adj-qty').value);
      const notes = document.getElementById('adj-notes').value.trim();

      if (isNaN(qty) || qty < 0) {
        document.getElementById('adjust-alert').innerHTML = '<div class="alert alert-error">Please enter a valid quantity of pieces</div>';
        return;
      }

      const btn = document.getElementById('adjust-save');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await API.invoke('inventory:adjustStock', {
          productId: id,
          movementType: type,
          quantity: qty,
          notes: notes || undefined
        });
        container.innerHTML = '';
        this._showToast('Pieces adjusted successfully', 'success');
        this._load();
      } catch (err) {
        document.getElementById('adjust-alert').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
        btn.disabled = false;
        btn.textContent = 'Apply Adjustment';
      }
    });
    container.addEventListener('click', e => { if (e.target.id === 'adjust-modal') container.innerHTML = ''; });
  },

  async _delete(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await API.invoke('product:delete', { id });
      this._showToast('Product deleted', 'success');
      this._load();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  },

  _showFormError(msg) {
    const el = document.getElementById('product-form-alert');
    if (el) el.innerHTML = `<div class="alert alert-error">${this._escape(msg)}</div>`;
  },

  _showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  _escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  },

  _fmtCurrency(v) {
    if (v == null || isNaN(v)) return '-';
    return '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

window.PRODUCT_SCREEN = PRODUCT_SCREEN;