const GIRVI_SCREEN = {
  _container: null,
  _loans: [],
  _pagination: { page: 1, pageSize: 50, total: 0 },
  _summary: null,
  _searchQuery: '',
  _metalFilter: 'all',
  _statusFilter: 'active',
  _viewMode: 'table', // 'table' | 'cards'

  async render(container) {
    this._container = container;
    const t = (k, fb) => window.I18N ? window.I18N.t(k, fb) : (fb || k);

    container.innerHTML = `
      <div class="screen-header" style="margin-bottom:16px;">
        <div>
          <h2>${t('girvi', 'Girvi (Pledge Management)')}</h2>
          <p class="text-muted">${window.I18N && window.I18N.getLang() === 'hi' ? 'सोना एवं चांदी गिरवी खाता, मासिक ब्याज गणना एवं एक्सील इम्पोर्ट प्रबंधित करें।' : 'Manage gold & silver pledged loans, live interest computation, and legacy excel imports.'}</p>
        </div>
        <div class="header-actions" style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-sm btn-secondary" id="girvi-undo-btn" title="Undo Last Import" style="font-size:12px;font-weight:600;cursor:pointer;">
            ↩️ Undo Import
          </button>
          <button class="btn btn-sm btn-secondary" id="girvi-redo-btn" title="Redo Last Import" style="font-size:12px;font-weight:600;cursor:pointer;">
            ↪️ Redo Import
          </button>
          <button class="btn btn-secondary" id="girvi-import-btn">${t('importExcel', '📥 Import Excel/CSV')}</button>
          <button class="btn btn-primary" id="girvi-new-btn">${t('newEntry', '➕ New Girvi Entry')}</button>
        </div>
      </div>

      <div class="stat-grid" id="girvi-summary-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px;">
        <div class="stat-card" style="background:var(--bg-card);padding:18px;border-radius:var(--radius);border:1px solid var(--border);">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">${t('activePledges', 'Active Pledges')}</div>
          <div style="font-size:26px;font-weight:800;color:var(--primary)" id="sum-active-count">0</div>
        </div>
        <div class="stat-card" style="background:var(--bg-card);padding:18px;border-radius:var(--radius);border:1px solid var(--border);">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">${t('totalDisbursed', 'Total Principal Disbursed')}</div>
          <div style="font-size:26px;font-weight:800;color:var(--success,#27ae60)" id="sum-total-principal">₹0</div>
        </div>
        <div class="stat-card" style="background:var(--bg-card);padding:18px;border-radius:var(--radius);border:1px solid var(--border);">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">${t('totalGold', 'Total Gold Pledged')}</div>
          <div style="font-size:26px;font-weight:800;color:var(--warning,#e67e22)" id="sum-gold-weight">0.00 gms</div>
        </div>
        <div class="stat-card" style="background:var(--bg-card);padding:18px;border-radius:var(--radius);border:1px solid var(--border);">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">${t('totalSilver', 'Total Silver Pledged')}</div>
          <div style="font-size:26px;font-weight:800;color:var(--info,#3498db)" id="sum-silver-weight">0.00 gms</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;padding:16px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
          <div style="display:flex;gap:12px;flex:1;min-width:300px;">
            <input type="text" id="girvi-search-input" class="form-control" style="font-size:14px;" placeholder="${t('searchPlaceholder', '🔍 Search by Girvi No., Name, Relation, Caste, Phone, Village, Item, Amount...')}" value="${this._escape(this._searchQuery)}">
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-body);">
              <button class="btn btn-sm ${this._viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}" id="girvi-view-table-btn" style="border:none;border-radius:0;padding:6px 12px;font-size:12px;font-weight:600;" title="Table View">📋 Table</button>
              <button class="btn btn-sm ${this._viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}" id="girvi-view-cards-btn" style="border:none;border-radius:0;padding:6px 12px;font-size:12px;font-weight:600;" title="Sliding Cards View">🪪 Cards</button>
            </div>
            <select id="girvi-metal-filter" class="form-control" style="width:130px;">
              <option value="all" ${this._metalFilter === 'all' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'सभी धातु' : 'All Metals'}</option>
              <option value="gold" ${this._metalFilter === 'gold' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'सोना (Gold)' : 'Gold'}</option>
              <option value="silver" ${this._metalFilter === 'silver' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'चांदी (Silver)' : 'Silver'}</option>
              <option value="mix" ${this._metalFilter === 'mix' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'मिक्स (Mix)' : 'Mix'}</option>
            </select>
            <select id="girvi-status-filter" class="form-control" style="width:140px;">
              <option value="all" ${this._statusFilter === 'all' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'सभी स्थिति' : 'All Status'}</option>
              <option value="active" ${this._statusFilter === 'active' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'सक्रिय (Active)' : 'Active'}</option>
              <option value="partially_redeemed" ${this._statusFilter === 'partially_redeemed' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'आंशिक चुकता' : 'Partially Paid'}</option>
              <option value="redeemed" ${this._statusFilter === 'redeemed' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'चुकता (Redeemed)' : 'Redeemed'}</option>
              <option value="auctioned" ${this._statusFilter === 'auctioned' ? 'selected' : ''}>${window.I18N && window.I18N.getLang() === 'hi' ? 'नीलाम (Auctioned)' : 'Auctioned'}</option>
            </select>
            <select id="girvi-pagesize-select" class="form-control" style="width:110px;" title="Items per page (up to 1 Lakh)">
              <option value="50" ${this._pagination.pageSize === 50 ? 'selected' : ''}>50 / page</option>
              <option value="100" ${this._pagination.pageSize === 100 ? 'selected' : ''}>100 / page</option>
              <option value="500" ${this._pagination.pageSize === 500 ? 'selected' : ''}>500 / page</option>
              <option value="1000" ${this._pagination.pageSize === 1000 ? 'selected' : ''}>1,000 / page</option>
              <option value="5000" ${this._pagination.pageSize === 5000 ? 'selected' : ''}>5,000 / page</option>
              <option value="100000" ${this._pagination.pageSize === 100000 ? 'selected' : ''}>All (1 Lakh)</option>
            </select>
            <button class="btn btn-secondary" id="girvi-refresh-btn">${t('refresh', '🔄 Refresh')}</button>
          </div>
        </div>
      </div>

      <div id="girvi-view-container">
        <!-- Content dynamically rendered as Table or Sliding Cards -->
      </div>

      <div id="girvi-pagination-container" style="margin-top:14px;"></div>

      <!-- Modals Container -->
      <div id="girvi-modals"></div>
    `;

    this._bindEvents();
    await this.loadData();
  },

  async init() {
    window.removeEventListener('customer-changed', this._onCustomerChanged);
    this._onCustomerChanged = () => this.loadData();
    window.addEventListener('customer-changed', this._onCustomerChanged);

    window.removeEventListener('language-changed', this._onLangChanged);
    this._onLangChanged = () => { if (this._container) this.render(this._container); };
    window.addEventListener('language-changed', this._onLangChanged);
  },

  async loadData() {
    try {
      const summary = await API.invoke('girvi:getSummary');
      this._summary = summary;
      this._updateSummaryCards(summary);

      const res = await API.invoke('girvi:search', {
        search: this._searchQuery,
        metal_type: this._metalFilter,
        status: this._statusFilter,
        page: this._pagination.page,
        pageSize: this._pagination.pageSize
      });

      this._loans = res.data || [];
      this._pagination = res.pagination || { page: 1, pageSize: this._pagination.pageSize, total: 0 };
      this._renderView();
      this._renderPagination();
      await this._updateUndoRedoButtons();
    } catch (err) {
      console.error('Failed to load Girvi loans:', err);
      const container = document.getElementById('girvi-view-container');
      if (container) container.innerHTML = `<div class="card" style="text-align:center;color:var(--danger);padding:30px;">Error loading data: ${this._escape(err.message)}</div>`;
    }
  },

  async _updateUndoRedoButtons() {
    try {
      const status = await API.invoke('girvi:getImportStatus');
      const undoBtn = document.getElementById('girvi-undo-btn');
      const redoBtn = document.getElementById('girvi-redo-btn');
      if (undoBtn) {
        if (status && status.canUndo && status.lastUndoBatch) {
          undoBtn.style.opacity = '1';
          undoBtn.style.cursor = 'pointer';
          undoBtn.className = 'btn btn-sm btn-warning';
          undoBtn.innerHTML = `↩️ Undo Import (${status.lastUndoBatch.successCount})`;
          undoBtn.title = `Click to undo last import of ${status.lastUndoBatch.successCount} records (${status.lastUndoBatch.createdAt || 'recent'})`;
        } else {
          undoBtn.style.opacity = '0.65';
          undoBtn.style.cursor = 'pointer';
          undoBtn.className = 'btn btn-sm btn-secondary';
          undoBtn.innerHTML = '↩️ Undo Import';
          undoBtn.title = 'No active CSV import batch to undo';
        }
      }
      if (redoBtn) {
        if (status && status.canRedo && status.lastRedoBatch) {
          redoBtn.style.opacity = '1';
          redoBtn.style.cursor = 'pointer';
          redoBtn.className = 'btn btn-sm btn-info';
          redoBtn.innerHTML = `↪️ Redo Import (${status.lastRedoBatch.successCount})`;
          redoBtn.title = `Click to re-apply undone import of ${status.lastRedoBatch.successCount} records`;
        } else {
          redoBtn.style.opacity = '0.65';
          redoBtn.style.cursor = 'pointer';
          redoBtn.className = 'btn btn-sm btn-secondary';
          redoBtn.innerHTML = '↪️ Redo Import';
          redoBtn.title = 'No undone import batch to redo';
        }
      }
    } catch (e) {
      console.warn('Could not update undo/redo status:', e);
    }
  },

  _updateSummaryCards(s) {
    if (!s) return;
    const countEl = document.getElementById('sum-active-count');
    const princEl = document.getElementById('sum-total-principal');
    const goldEl = document.getElementById('sum-gold-weight');
    const silvEl = document.getElementById('sum-silver-weight');

    if (countEl) countEl.textContent = s.activeCount || 0;
    if (princEl) princEl.textContent = `₹${(s.totalPrincipalDisbursed || 0).toLocaleString('en-IN')}`;
    if (goldEl) goldEl.textContent = `${(s.totalGoldWeight || 0).toFixed(2)} gms`;
    if (silvEl) silvEl.textContent = `${(s.totalSilverWeight || 0).toFixed(2)} gms`;
  },

  _renderView() {
    const container = document.getElementById('girvi-view-container');
    if (!container) return;

    if (this._loans.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:50px 20px;color:var(--text-muted);font-size:15px;">
          <div style="font-size:40px;margin-bottom:10px;">💍</div>
          <h3>No Girvi pledges found</h3>
          <p style="margin-top:6px;">Click <strong>"+ New Girvi Entry"</strong> or <strong>"📥 Import Excel/CSV"</strong> to add records.</p>
        </div>
      `;
      return;
    }

    if (this._viewMode === 'cards') {
      this._renderCardsView(container);
    } else {
      this._renderTableView(container);
    }
  },

  _renderTableView(container) {
    const t = (k, fb) => window.I18N ? window.I18N.t(k, fb) : (fb || k);

    container.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border);">
        <div style="padding:8px 16px;background:var(--bg-body);font-size:12px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);">
          <span>👉 Slide / Scroll horizontally to view all loan parameters</span>
          <span>Showing <strong>${this._loans.length}</strong> of <strong>${this._pagination.total || this._loans.length}</strong> records</span>
        </div>
        <div class="table-responsive" style="overflow-x:auto;width:100%;-webkit-overflow-scrolling:touch;">
          <table class="table" style="min-width:1800px;width:100%;margin:0;border-collapse:collapse;white-space:nowrap;">
            <thead>
              <tr style="background:var(--bg-secondary);border-bottom:2px solid var(--border);">
                <th style="padding:14px 16px;text-align:left;width:110px;">${t('girviNo', 'Girvi No. (गिरवी क्र.)')}</th>
                <th style="padding:14px 16px;text-align:left;width:105px;">${t('girviDate', 'Pledge Date (दिनांक)')}</th>
                <th style="padding:14px 16px;text-align:left;min-width:180px;">${t('customerName', 'Customer Name (ग्राहक नाम)')}</th>
                <th style="padding:14px 16px;text-align:left;width:120px;">${t('caste', 'Caste (जाति)')}</th>
                <th style="padding:14px 16px;text-align:left;min-width:160px;">${t('address', 'Address (पता)')}</th>
                <th style="padding:14px 16px;text-align:left;width:120px;">${t('mobilePhone', 'Mobile No. (मोबाइल)')}</th>
                <th style="padding:14px 16px;text-align:left;min-width:170px;">${t('ornamentItem', 'Ornament (आभूषण)')}</th>
                <th style="padding:14px 16px;text-align:left;width:130px;">${t('metalType', 'Metal & Wt (धातु व वजन)')}</th>
                <th style="padding:14px 16px;text-align:right;width:120px;">${t('principalAmount', 'Principal (रकम ₹)')}</th>
                <th style="padding:14px 16px;text-align:center;width:110px;">${t('monthlyRate', 'Rate% / Type')}</th>
                <th style="padding:14px 16px;text-align:center;width:110px;">${t('duration', 'Duration (अवधि)')}</th>
                <th style="padding:14px 16px;text-align:right;width:145px;background:#e8f8f0;color:#27ae60;">✅ साधारण ब्याज<br><small style="font-weight:400;">(Simple Interest)</small></th>
                <th style="padding:14px 16px;text-align:right;width:140px;background:#fef3e2;color:#e67e22;">⚡ चक्रवर्ती ब्याज<br><small style="font-weight:400;">(Compound Interest)</small></th>
                <th style="padding:14px 16px;text-align:right;width:160px;background:#e8f8f0;color:#27ae60;">✅ कुल बाकी (मूलधन + SI)<br><small style="font-weight:700;">(Total Dues: P + SI ₹)</small></th>
                <th style="padding:14px 16px;text-align:right;width:160px;background:#fff5e6;color:#d35400;">⚡ मूलधन + चक्रवर्ती<br><small style="font-weight:700;">(Total: P + CI ₹)</small></th>
                <th style="padding:14px 16px;text-align:center;width:100px;">${t('status', 'Status (स्थिति)')}</th>
                <th style="padding:14px 16px;text-align:center;width:210px;">${t('actions', 'Actions (कार्य)')}</th>
              </tr>
            </thead>
            <tbody id="girvi-table-body">
              ${this._loans.map(loan => {
                const dues = loan.dues || {};
                const statusBadge = this._getStatusBadge(loan.status);
                const weightDisplay = loan.metal_type === 'gold'
                  ? `${loan.gold_weight}g Gold`
                  : loan.metal_type === 'silver'
                    ? `${loan.silver_weight}g Silver`
                    : `${loan.gold_weight}g Au / ${loan.silver_weight}g Ag`;

                const si = dues.simpleInterest !== undefined ? dues.simpleInterest : dues.accumulatedInterest || 0;
                const ci = dues.compoundInterest !== undefined ? dues.compoundInterest : dues.compoundInterestValue || si;
                const compoundExtra = dues.compoundExtra || Math.max(0, ci - si);
                const iType = loan.interest_type || 'simple';
                const iTypeBadge = iType === 'compound'
                  ? `<span style="font-size:10px;background:#fef3e2;color:#e67e22;padding:1px 5px;border-radius:4px;font-weight:700;">COMP</span>`
                  : `<span style="font-size:10px;background:#e8f8f0;color:#27ae60;padding:1px 5px;border-radius:4px;font-weight:700;">SI</span>`;

                return `
                  <tr style="border-bottom:1px solid var(--border);transition:background 0.2s ease;">
                    <td style="padding:12px 16px;font-weight:700;color:var(--primary);">${this._escape(loan.loan_number)}</td>
                    <td style="padding:12px 16px;color:var(--text-muted);">${this._escape(loan.loan_date)}</td>
                    <td style="padding:12px 16px;">
                      <div style="font-weight:700;color:var(--text);">${this._escape(loan.customer_name)}</div>
                      ${loan.father_husband_name ? `<div style="font-size:12px;color:var(--text-muted);">S/o ${this._escape(loan.father_husband_name)}</div>` : ''}
                    </td>
                    <td style="padding:12px 16px;">
                      ${loan.caste ? `<span style="font-weight:600;color:var(--primary);">${this._escape(loan.caste)}</span>` : '<span style="color:var(--text-muted);">-</span>'}
                    </td>
                    <td style="padding:12px 16px;color:var(--text);">${this._escape(loan.address)}</td>
                    <td style="padding:12px 16px;font-family:monospace;font-size:13px;">${this._escape(loan.phone1)}</td>
                    <td style="padding:12px 16px;font-weight:500;">${this._escape(loan.item_name)}</td>
                    <td style="padding:12px 16px;"><span class="badge badge-info" style="font-size:12px;padding:4px 8px;">${weightDisplay}</span></td>
                    <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:14px;">₹${(loan.principal_amount || 0).toLocaleString('en-IN')}</td>
                    <td style="padding:12px 16px;text-align:center;">
                      <div style="font-weight:700;">${loan.monthly_interest_percent}%</div>
                      ${iTypeBadge}
                    </td>
                    <td style="padding:12px 16px;text-align:center;font-weight:700;color:var(--text);">${dues.monthsElapsed || 0}m ${dues.daysRemainder || 0}d</td>
                    <!-- Simple Interest Column -->
                    <td style="padding:12px 16px;text-align:right;background:#f7fdf9;">
                      <div style="font-weight:700;color:#27ae60;font-size:14px;">₹${si.toLocaleString('en-IN')}</div>
                      <div style="font-size:10px;color:var(--text-muted);">P×${loan.monthly_interest_percent}%×${dues.billableMonths || 0}m/100</div>
                    </td>
                    <!-- Compound Interest Column -->
                    <td style="padding:12px 16px;text-align:right;background:#fffbf3;">
                      <div style="font-weight:700;color:#e67e22;font-size:14px;">₹${ci.toLocaleString('en-IN')}</div>
                      ${compoundExtra > 0
                        ? `<div style="font-size:10px;color:#e67e22;">(+₹${compoundExtra.toLocaleString('en-IN')} extra)</div>`
                        : `<div style="font-size:10px;color:var(--text-muted);">(= SI, under 12m)</div>`}
                    </td>
                    <!-- Total Dues: Principal + Simple Interest Column -->
                    <td style="padding:12px 16px;text-align:right;background:#f7fdf9;">
                      <div style="font-weight:800;color:#27ae60;font-size:14px;">₹${((loan.principal_amount || 0) + si).toLocaleString('en-IN')}</div>
                      <div style="font-size:10px;color:var(--text-muted);">₹${(loan.principal_amount || 0).toLocaleString('en-IN')} + ₹${si.toLocaleString('en-IN')}</div>
                    </td>
                    <!-- Principal + Compound Interest Column -->
                    <td style="padding:12px 16px;text-align:right;background:#fff8ee;">
                      <div style="font-weight:800;color:#d35400;font-size:14px;">₹${((loan.principal_amount || 0) + ci).toLocaleString('en-IN')}</div>
                      <div style="font-size:10px;color:var(--text-muted);">₹${(loan.principal_amount || 0).toLocaleString('en-IN')} + ₹${ci.toLocaleString('en-IN')}</div>
                    </td>
                    <td style="padding:12px 16px;text-align:center;">${statusBadge}</td>
                    <td style="padding:12px 16px;text-align:center;">
                      <div style="display:inline-flex;gap:6px;align-items:center;">
                        <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.viewLoan(${loan.id})" title="View Details & Receipt">👁️ View</button>
                        <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.editLoan(${loan.id})" title="Edit Entry">📝 Edit</button>
                        <button class="btn btn-sm btn-success" onclick="GIRVI_SCREEN.payLoan(${loan.id})" style="background:#27ae60;border-color:#27ae60;color:#fff;font-weight:600;" title="Record Payment">💳 Pay</button>
                        <button class="btn btn-sm" onclick="GIRVI_SCREEN.sendWhatsApp(${loan.id})" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:600;" title="Send WhatsApp Reminder">📲 WA</button>
                        <button class="btn btn-sm btn-danger" onclick="GIRVI_SCREEN.deleteLoan(${loan.id})" title="Delete Entry">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  _renderCardsView(container) {
    const cardsHtml = this._loans.map(loan => {
      const dues = loan.dues || {};
      const statusBadge = this._getStatusBadge(loan.status);
      const weightDisplay = loan.metal_type === 'gold' 
        ? `${loan.gold_weight}g Gold` 
        : loan.metal_type === 'silver' 
          ? `${loan.silver_weight}g Silver` 
          : `${loan.gold_weight}g Au / ${loan.silver_weight}g Ag`;

      return `
        <div class="card" style="border-left:4px solid var(--primary);box-shadow:var(--shadow-sm);margin:0;display:flex;flex-direction:column;justify-content:space-between;padding:16px;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <div>
                <span style="font-weight:800;color:var(--primary);font-size:13px;">${this._escape(loan.loan_number)}</span>
                <div style="font-weight:800;font-size:16px;margin-top:2px;">${this._escape(loan.customer_name)}</div>
                ${loan.father_husband_name ? `<div style="font-size:12px;color:var(--text-muted);">S/o ${this._escape(loan.father_husband_name)}</div>` : ''}
              </div>
              <div style="text-align:right;">
                ${statusBadge}
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">📅 ${this._escape(loan.loan_date)}</div>
              </div>
            </div>

            <div style="background:var(--bg-body);padding:10px 12px;border-radius:8px;font-size:12px;margin:8px 0;line-height:1.6;border:1px solid var(--border);">
              ${loan.caste ? `<div>🏷️ <strong>Caste (जाति):</strong> <span style="color:var(--primary);font-weight:700;">${this._escape(loan.caste)}</span></div>` : ''}
              <div>📍 <strong>Address (पता):</strong> ${this._escape(loan.address)}</div>
              <div>📞 <strong>Mobile (मोबाइल):</strong> <code>${this._escape(loan.phone1)}</code></div>
              <div>💎 <strong>Ornament (आभूषण):</strong> ${this._escape(loan.item_name)} (${weightDisplay})</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;padding-top:6px;border-top:1px dashed var(--border);font-size:12px;">
              <div>
                <div style="font-size:11px;color:var(--text-muted);">Principal (रकम ₹)</div>
                <div style="font-weight:800;font-size:15px;color:var(--text);">₹${(loan.principal_amount || 0).toLocaleString('en-IN')}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:11px;color:#27ae60;font-weight:700;">✅ Total Dues (P + SI ₹)</div>
                <div style="font-weight:800;font-size:16px;color:#27ae60;">₹${((loan.principal_amount || 0) + (dues.simpleInterest !== undefined ? dues.simpleInterest : dues.accumulatedInterest || 0)).toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div style="background:var(--bg-body);padding:8px 12px;border-radius:6px;margin-top:8px;border:1px solid var(--border);">
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">INTEREST (ब्याज) — ⏳ ${dues.monthsElapsed || 0}m ${dues.daysRemainder || 0}d @ ${loan.monthly_interest_percent}%</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                <div style="background:#f7fdf9;padding:6px 8px;border-radius:6px;">
                  <div style="font-size:10px;color:#27ae60;font-weight:700;">✅ साधारण ब्याज (SI)</div>
                  <div style="font-size:14px;font-weight:800;color:#27ae60;">₹${((dues.simpleInterest !== undefined ? dues.simpleInterest : dues.accumulatedInterest) || 0).toLocaleString('en-IN')}</div>
                </div>
                <div style="background:#fffbf3;padding:6px 8px;border-radius:6px;">
                  <div style="font-size:10px;color:#e67e22;font-weight:700;">⚡ चक्रवर्ती ब्याज (CI)</div>
                  <div style="font-size:14px;font-weight:800;color:#e67e22;">₹${((dues.compoundInterest !== undefined ? dues.compoundInterest : dues.accumulatedInterest) || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div style="font-size:11px;margin-top:4px;text-align:right;">
                ${(loan.interest_type || 'simple') === 'compound'
                  ? '<span style="background:#fef3e2;color:#e67e22;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;">⚡ COMPOUND CHARGED</span>'
                  : '<span style="background:#e8f8f0;color:#27ae60;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;">✅ SIMPLE CHARGED</span>'}
              </div>
              <div style="background:#fff8ee;padding:6px 10px;border-radius:6px;border:1px solid #fed7aa;margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;color:#d35400;font-weight:700;">⚡ मूलधन + चक्रवर्ती (P + CI):</span>
                <span style="font-size:15px;font-weight:800;color:#d35400;">₹${((loan.principal_amount || 0) + ((dues.compoundInterest !== undefined ? dues.compoundInterest : dues.compoundInterestValue || dues.accumulatedInterest) || 0)).toLocaleString('en-IN')}</span>
              </div>
            </div>

          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 40px;gap:6px;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
            <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.viewLoan(${loan.id})" title="View Details">👁️ View</button>
            <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.editLoan(${loan.id})" title="Edit Entry">📝 Edit</button>
            <button class="btn btn-sm btn-success" onclick="GIRVI_SCREEN.payLoan(${loan.id})" style="background:#27ae60;border-color:#27ae60;color:#fff;font-weight:600;" title="Record Payment">💳 Pay</button>
            <button class="btn btn-sm" onclick="GIRVI_SCREEN.sendWhatsApp(${loan.id})" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:600;" title="Send WhatsApp Reminder">📲 WA</button>
            <button class="btn btn-sm btn-danger" onclick="GIRVI_SCREEN.deleteLoan(${loan.id})" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;">
        ${cardsHtml}
      </div>
    `;
  },

  _renderPagination() {
    const p = this._pagination;
    const container = document.getElementById('girvi-pagination-container');
    if (!container || !p || p.total <= p.pageSize) {
      if (container) container.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(p.total / p.pageSize) || 1;
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-card);border-radius:var(--radius);border:1px solid var(--border);">
        <span style="font-size:13px;color:var(--text-muted);">
          Showing <strong>${(p.page - 1) * p.pageSize + 1}</strong> to <strong>${Math.min(p.page * p.pageSize, p.total)}</strong> of <strong>${p.total.toLocaleString('en-IN')}</strong> Girvi records
        </span>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.goPage(1)" ${p.page <= 1 ? 'disabled' : ''}>« First</button>
          <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.goPage(${p.page - 1})" ${p.page <= 1 ? 'disabled' : ''}>‹ Prev</button>
          <span style="padding:0 8px;font-weight:700;font-size:13px;">Page ${p.page} of ${totalPages}</span>
          <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.goPage(${p.page + 1})" ${p.page >= totalPages ? 'disabled' : ''}>Next ›</button>
          <button class="btn btn-sm btn-secondary" onclick="GIRVI_SCREEN.goPage(${totalPages})" ${p.page >= totalPages ? 'disabled' : ''}>Last »</button>
        </div>
      </div>
    `;
  },

  goPage(page) {
    this._pagination.page = page;
    this.loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  _getStatusBadge(status) {
    switch (status) {
      case 'active': return '<span class="badge badge-success" style="background:#27ae60;color:#fff;">Active</span>';
      case 'partially_redeemed': return '<span class="badge badge-warning" style="background:#e67e22;color:#fff;">Partially Paid</span>';
      case 'redeemed': return '<span class="badge badge-secondary">Redeemed</span>';
      case 'auctioned': return '<span class="badge badge-danger">Auctioned</span>';
      default: return `<span class="badge">${status}</span>`;
    }
  },

  _bindEvents() {
    const searchInput = document.getElementById('girvi-search-input');
    const metalFilter = document.getElementById('girvi-metal-filter');
    const statusFilter = document.getElementById('girvi-status-filter');
    const pageSizeSelect = document.getElementById('girvi-pagesize-select');
    const refreshBtn = document.getElementById('girvi-refresh-btn');
    const newBtn = document.getElementById('girvi-new-btn');
    const importBtn = document.getElementById('girvi-import-btn');
    const tableBtn = document.getElementById('girvi-view-table-btn');
    const cardsBtn = document.getElementById('girvi-view-cards-btn');

    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this._searchQuery = e.target.value.trim();
          this._pagination.page = 1;
          this.loadData();
        }, 250);
      });
    }

    if (metalFilter) {
      metalFilter.addEventListener('change', (e) => {
        this._metalFilter = e.target.value;
        this._pagination.page = 1;
        this.loadData();
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this._statusFilter = e.target.value;
        this._pagination.page = 1;
        this.loadData();
      });
    }

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this._pagination.pageSize = parseInt(e.target.value, 10) || 50;
        this._pagination.page = 1;
        this.loadData();
      });
    }

    if (tableBtn) {
      tableBtn.addEventListener('click', () => {
        this._viewMode = 'table';
        tableBtn.classList.replace('btn-secondary', 'btn-primary');
        if (cardsBtn) cardsBtn.classList.replace('btn-primary', 'btn-secondary');
        this._renderView();
      });
    }

    if (cardsBtn) {
      cardsBtn.addEventListener('click', () => {
        this._viewMode = 'cards';
        cardsBtn.classList.replace('btn-secondary', 'btn-primary');
        if (tableBtn) tableBtn.classList.replace('btn-primary', 'btn-secondary');
        this._renderView();
      });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadData());
    if (newBtn) newBtn.addEventListener('click', () => this._openLoanModal());
    if (importBtn) importBtn.addEventListener('click', () => this._openImportModal());

    const undoBtn = document.getElementById('girvi-undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', async () => {
        try {
          const status = await API.invoke('girvi:getImportStatus');
          if (!status || !status.canUndo || !status.lastUndoBatch) {
            alert('ℹ️ No CSV/Excel import batch is currently available to undo.\n\nTo use this feature:\n1. Click "📥 Import Excel/CSV" to import a spreadsheet.\n2. If any mistake happens, click "↩️ Undo Import" to instantly remove all records from that batch.');
            return;
          }

          const count = status.lastUndoBatch.successCount || 0;
          if (confirm(`↩️ Are you sure you want to undo the last CSV import batch of ${count} records?\n\nThis will safely remove all records created in that import.`)) {
            const res = await API.invoke('girvi:undoLastImport');
            alert(`↩️ Undone Successfully!\nReverted ${res.count} imported Girvi records.`);
            await this.loadData();
          }
        } catch (err) {
          alert(`Undo failed: ${err.message}`);
        }
      });
    }

    const redoBtn = document.getElementById('girvi-redo-btn');
    if (redoBtn) {
      redoBtn.addEventListener('click', async () => {
        try {
          const status = await API.invoke('girvi:getImportStatus');
          if (!status || !status.canRedo || !status.lastRedoBatch) {
            alert('ℹ️ No undone import batch is currently available to redo.\n\nThis button is used to restore records after you have undone an import.');
            return;
          }

          const count = status.lastRedoBatch.successCount || 0;
          if (confirm(`↪️ Are you sure you want to re-apply the undone CSV import batch of ${count} records?`)) {
            const res = await API.invoke('girvi:redoLastImport');
            alert(`↪️ Restored Successfully!\nRestored ${res.count} imported Girvi records.`);
            await this.loadData();
          }
        } catch (err) {
          alert(`Redo failed: ${err.message}`);
        }
      });
    }
  },

  // Direct action methods bound globally for 100% reliable execution
  viewLoan(loanId) { this._openViewModal(loanId); },
  editLoan(loanId) { this._openLoanModal(loanId); },
  payLoan(loanId) { this._openPaymentModal(loanId); },
  deleteLoan(loanId) { this._confirmDelete(loanId); },

  async _openLoanModal(loanId = null) {
    let loan = null;
    if (loanId) {
      loan = await API.invoke('girvi:getById', { id: loanId });
    }

    const isEdit = !!loan;
    const modalHtml = `
      <div class="modal-overlay active" id="girvi-form-modal">
        <div class="modal" style="max-width:720px;width:95%;">
          <div class="modal-header">
            <h3>${isEdit ? '📝 Edit Girvi Pledge Entry' : '➕ New Girvi Pledge Entry'}</h3>
            <button class="modal-close" id="close-form-modal-btn">&times;</button>
          </div>
          <form id="girvi-loan-form">
            <div class="modal-body" style="max-height:75vh;overflow-y:auto;padding:20px 24px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Girvi / Ticket Number</label>
                  <input type="text" id="g-loan-number" class="form-control" placeholder="Auto-generated (e.g. GIR-0001)" value="${loan ? this._escape(loan.loan_number) : ''}" ${isEdit ? 'readonly' : ''}>
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Pledge Date *</label>
                  <input type="date" id="g-loan-date" class="form-control" required value="${loan ? loan.loan_date : new Date().toISOString().split('T')[0]}">
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;margin-top:14px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Customer Full Name (ग्राहक नाव) *</label>
                  <input type="text" id="g-customer-name" class="form-control" required placeholder="e.g. Ramesh Patel" value="${loan ? this._escape(loan.customer_name) : ''}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Father / Husband Name (पिता / पति का नाम)</label>
                  <input type="text" id="g-father-name" class="form-control" placeholder="e.g. Dattatray Patel" value="${loan ? this._escape(loan.father_husband_name || '') : ''}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Caste (जाति)</label>
                  <input type="text" id="g-caste" class="form-control" placeholder="e.g. Maratha, Brahmin, Jain" value="${loan ? this._escape(loan.caste || '') : ''}">
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Mobile Number (मोबाइल नंबर) *</label>
                  <input type="tel" id="g-phone1" class="form-control" required placeholder="e.g. 9876543210" value="${loan ? this._escape(loan.phone1) : ''}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Address (पता) *</label>
                  <input type="text" id="g-address" class="form-control" required placeholder="e.g. Indapur" value="${loan ? this._escape(loan.address) : ''}">
                </div>
              </div>

              <hr style="margin:18px 0;border-color:var(--border);">

              <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Ornament Description (आभूषण विवरण) *</label>
                  <input type="text" id="g-item-name" class="form-control" required placeholder="e.g. Gold Chain 22K (सोना साखळी)" value="${loan ? this._escape(loan.item_name) : ''}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Metal Type (धातु प्रकार) *</label>
                  <select id="g-metal-type" class="form-control" required>
                    <option value="gold" ${!loan || loan.metal_type === 'gold' ? 'selected' : ''}>Gold (सोना)</option>
                    <option value="silver" ${loan && loan.metal_type === 'silver' ? 'selected' : ''}>Silver (चांदी)</option>
                    <option value="mix" ${loan && loan.metal_type === 'mix' ? 'selected' : ''}>Mix (मिक्स)</option>
                    <option value="other" ${loan && loan.metal_type === 'other' ? 'selected' : ''}>Other (अन्य)</option>
                  </select>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:14px;margin-top:14px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Gold Weight (सोना ग्राम)</label>
                  <input type="number" step="0.001" id="g-gold-weight" class="form-control" placeholder="0.000" value="${loan ? loan.gold_weight : '0.000'}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Silver Weight (चांदी ग्राम)</label>
                  <input type="number" step="0.001" id="g-silver-weight" class="form-control" placeholder="0.000" value="${loan ? loan.silver_weight : '0.000'}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Principal Loan (रकम ₹) *</label>
                  <input type="number" step="1" id="g-principal-amount" class="form-control" required placeholder="e.g. 50000" value="${loan ? loan.principal_amount : ''}">
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Monthly Interest Rate (मासिक ब्याज दर %) *</label>
                  <div style="display:flex;gap:6px;">
                    <select id="g-interest-preset" class="form-control" style="width:105px;">
                      <option value="">Preset</option>
                      <option value="1.0">1.0%</option>
                      <option value="1.5">1.5%</option>
                      <option value="2.0">2.0%</option>
                      <option value="2.5">2.5%</option>
                      <option value="3.0">3.0%</option>
                    </select>
                    <input type="number" step="0.01" id="g-interest-rate" class="form-control" style="flex:1;" required placeholder="e.g. 2.0" value="${loan ? loan.monthly_interest_percent : '2.0'}">
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Interest Type (ब्याज प्रकार) *</label>
                  <select id="g-interest-type" class="form-control" required>
                    <option value="simple" ${!loan || (loan.interest_type || 'simple') === 'simple' ? 'selected' : ''}>✅ साधारण ब्याज (Simple Interest)</option>
                    <option value="compound" ${loan && loan.interest_type === 'compound' ? 'selected' : ''}>⚡ चक्रवर्ती ब्याज (Compound Interest)</option>
                  </select>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
                    Simple = P×R×M/100 | Compound = yearly compounding
                  </div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Reference Person (हवाला व्यक्ति)</label>
                  <input type="text" id="g-reference-person" class="form-control" placeholder="e.g. Suresh Sheth" value="${loan ? this._escape(loan.reference_person || '') : ''}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Locker Number (लॉकर नं.)</label>
                  <input type="text" id="g-locker-number" class="form-control" placeholder="e.g. L-12" value="${loan ? this._escape(loan.locker_number || '') : ''}">
                </div>
              </div>

              <div style="margin-top:14px;">
                <label class="form-label" style="font-weight:600;">Remarks / Notes (टिप्पणी / विवरण)</label>
                <input type="text" id="g-notes" class="form-control" placeholder="e.g. 22K Hallmarked item" value="${loan ? this._escape(loan.notes || '') : ''}">
              </div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cancel-form-modal-btn">Cancel</button>
              <button type="submit" class="btn btn-primary" id="save-form-modal-btn">${isEdit ? 'Save Changes' : 'Create Girvi Entry'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('girvi-modals').innerHTML = modalHtml;

    const closeBtn = document.getElementById('close-form-modal-btn');
    const cancelBtn = document.getElementById('cancel-form-modal-btn');
    const form = document.getElementById('girvi-loan-form');

    const presetSelect = document.getElementById('g-interest-preset');
    const rateInput = document.getElementById('g-interest-rate');
    if (presetSelect && rateInput) {
      presetSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          rateInput.value = e.target.value;
        }
      });
    }

    const closeModal = () => { document.getElementById('girvi-modals').innerHTML = ''; };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('save-form-modal-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
          const payload = {
            loan_number: document.getElementById('g-loan-number').value.trim(),
            loan_date: document.getElementById('g-loan-date').value,
            customer_name: document.getElementById('g-customer-name').value.trim(),
            father_husband_name: document.getElementById('g-father-name').value.trim(),
            caste: document.getElementById('g-caste')?.value.trim() || '',
            phone1: document.getElementById('g-phone1').value.trim(),
            address: document.getElementById('g-address').value.trim(),
            item_name: document.getElementById('g-item-name').value.trim(),
            metal_type: document.getElementById('g-metal-type').value,
            gold_weight: document.getElementById('g-gold-weight').value,
            silver_weight: document.getElementById('g-silver-weight').value,
            principal_amount: document.getElementById('g-principal-amount').value,
            monthly_interest_percent: document.getElementById('g-interest-rate').value,
            interest_type: document.getElementById('g-interest-type')?.value || 'simple',
            locker_number: document.getElementById('g-locker-number')?.value.trim() || '',
            reference_person: document.getElementById('g-reference-person').value.trim(),
            notes: document.getElementById('g-notes').value.trim()
          };

          if (isEdit) {
            await API.invoke('girvi:update', { id: loan.id, data: payload });
            if (typeof Toast !== 'undefined') Toast.show('Girvi entry updated successfully', 'success');
          } else {
            await API.invoke('girvi:create', payload);
            if (typeof Toast !== 'undefined') Toast.show('New Girvi entry created successfully', 'success');
          }

          closeModal();
          this.loadData();
        } catch (err) {
          alert(`Error saving entry: ${err.message}`);
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Girvi Entry';
        }
      });
    }
  },

  async _openViewModal(loanId) {
    const loan = await API.invoke('girvi:getById', { id: loanId });
    if (!loan) return;

    const dues = loan.dues || {};
    const txns = dues.transactions || [];

    const modalHtml = `
      <div class="modal-overlay active" id="girvi-view-modal">
        <div class="modal" style="max-width:750px;width:95%;">
          <div class="modal-header">
            <h3>💍 Girvi Pledge Ticket #${this._escape(loan.loan_number)}</h3>
            <button class="modal-close" id="close-view-modal-btn">&times;</button>
          </div>
          <div class="modal-body" style="max-height:78vh;overflow-y:auto;padding:20px 24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-body);padding:16px 20px;border-radius:var(--radius);margin-bottom:16px;border:1px solid var(--border);">
              <div>
                <h3 style="margin:0;font-size:18px;color:var(--primary);">${this._escape(loan.customer_name)}</h3>
                <div style="font-size:14px;color:var(--text-muted);margin-top:2px;">📍 ${this._escape(loan.address)} • 📞 <strong>${this._escape(loan.phone1)}</strong></div>
                ${loan.father_husband_name ? `<div style="font-size:13px;color:var(--text-muted);">Relation: <strong>${this._escape(loan.father_husband_name)}</strong></div>` : ''}
                ${loan.caste ? `<div style="font-size:13px;color:var(--text-muted);">Caste / जाति: <strong style="color:var(--primary);">${this._escape(loan.caste)}</strong></div>` : ''}
                ${loan.reference_person ? `<div style="font-size:13px;color:var(--text-muted);">Reference: <strong>${this._escape(loan.reference_person)}</strong></div>` : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-size:12px;font-weight:600;color:var(--text-muted);">PLEDGE DATE</div>
                <div style="font-size:16px;font-weight:800;">${this._escape(loan.loan_date)}</div>
                <div style="margin-top:6px;">${this._getStatusBadge(loan.status)}</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
              <div style="background:var(--bg-body);padding:14px;border-radius:var(--radius);border:1px solid var(--border);">
                <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">PLEDGED ORNAMENT</div>
                <div style="font-weight:700;font-size:16px;margin-top:6px;color:var(--text);">${this._escape(loan.item_name)}</div>
                <div style="font-size:13px;margin-top:4px;">Metal: <strong style="text-transform:uppercase;">${this._escape(loan.metal_type)}</strong></div>
                <div style="font-size:13px;margin-top:2px;">Gold: <strong>${loan.gold_weight} gms</strong> | Silver: <strong>${loan.silver_weight} gms</strong></div>
                ${loan.notes ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Notes: ${this._escape(loan.notes)}</div>` : ''}
              </div>

              <div style="background:var(--bg-body);padding:14px;border-radius:var(--radius);border:1px solid var(--border);">
                <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">LIVE DUES COMPUTATION (ब्याज व बकाया गणना)</div>
                <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:13px;"><span>Principal Loan (रकम):</span> <strong>₹${(loan.principal_amount || 0).toLocaleString('en-IN')}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:13px;"><span>Monthly Rate (मासिक दर):</span> <strong>${loan.monthly_interest_percent}% /month</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:13px;"><span>Interest Base Date (गणना दिनांक):</span> <strong style="color:var(--primary);">${loan.last_interest_date || loan.loan_date} ${loan.last_interest_date && loan.last_interest_date !== loan.loan_date ? '(Last Paid)' : ''}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:13px;"><span>Duration (अवधि):</span> <strong style="color:var(--primary);">${dues.monthsElapsed || 0}m ${dues.daysRemainder || 0}d (${dues.billableMonths || dues.monthsElapsed || 0} billable months)</strong></div>
                <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:13px;"><span>Interest Type:</span>
                  <strong>${(loan.interest_type || 'simple') === 'compound'
                    ? '<span style="color:#e67e22;">⚡ Compound (चक्रवर्ती)</span>'
                    : '<span style="color:#27ae60;">✅ Simple (साधारण)</span>'}</strong>
                </div>
                <hr style="margin:10px 0;border-color:var(--border);">
                <!-- Dual Interest Breakdown -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div style="background:#f7fdf9;padding:10px 12px;border-radius:8px;border:1px solid #d4edda;">
                    <div style="font-size:11px;color:#27ae60;font-weight:700;margin-bottom:3px;">✅ साधारण ब्याज (Simple Interest)</div>
                    <div style="font-size:18px;font-weight:800;color:#27ae60;">₹${((dues.simpleInterest !== undefined ? dues.simpleInterest : dues.accumulatedInterest) || 0).toLocaleString('en-IN')}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">P × R% × ${dues.billableMonths || dues.monthsElapsed || 0}m / 100</div>
                  </div>
                  <div style="background:#fffbf3;padding:10px 12px;border-radius:8px;border:1px solid #fde8c8;">
                    <div style="font-size:11px;color:#e67e22;font-weight:700;margin-bottom:3px;">⚡ चक्रवर्ती ब्याज (Compound Interest)</div>
                    <div style="font-size:18px;font-weight:800;color:#e67e22;">₹${((dues.compoundInterest !== undefined ? dues.compoundInterest : dues.accumulatedInterest) || 0).toLocaleString('en-IN')}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Yearly compounding @ ${(loan.monthly_interest_percent * 12).toFixed(1)}% p.a.</div>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;margin-bottom:8px;">
                  <div style="background:#f7fdf9;padding:10px 12px;border-radius:8px;border:1px solid #d4edda;">
                    <div style="font-size:11px;color:#27ae60;font-weight:700;">✅ Total Dues (मूलधन + साधारण ब्याज):</div>
                    <div style="font-size:17px;font-weight:800;color:#27ae60;margin-top:2px;">₹${((loan.principal_amount || 0) + ((dues.simpleInterest !== undefined ? dues.simpleInterest : dues.accumulatedInterest) || 0)).toLocaleString('en-IN')}</div>
                    <div style="font-size:10px;color:var(--text-muted);">₹${(loan.principal_amount || 0).toLocaleString('en-IN')} + ₹${((dues.simpleInterest !== undefined ? dues.simpleInterest : dues.accumulatedInterest) || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div style="background:#fff8ee;padding:10px 12px;border-radius:8px;border:1px solid #fed7aa;">
                    <div style="font-size:11px;color:#d35400;font-weight:700;">⚡ Total (मूलधन + चक्रवर्ती ब्याज):</div>
                    <div style="font-size:17px;font-weight:800;color:#d35400;margin-top:2px;">₹${((loan.principal_amount || 0) + ((dues.compoundInterest !== undefined ? dues.compoundInterest : dues.compoundInterestValue || dues.accumulatedInterest) || 0)).toLocaleString('en-IN')}</div>
                    <div style="font-size:10px;color:var(--text-muted);">₹${(loan.principal_amount || 0).toLocaleString('en-IN')} + ₹${((dues.compoundInterest !== undefined ? dues.compoundInterest : dues.accumulatedInterest) || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:13px;color:var(--success);"><span>Total Paid (जमा):</span> <strong>-₹${((dues.totalInterestPaid || 0) + (dues.totalPrincipalPaid || 0)).toLocaleString('en-IN')}</strong></div>
              </div>

            </div>

            <h4 style="margin:16px 0 8px 0;">📜 Payment Transactions History</h4>
            <div class="table-responsive" style="border:1px solid var(--border);border-radius:var(--radius);">
              <table class="table" style="width:100%;margin:0;font-size:13px;">
                <thead>
                  <tr style="background:var(--bg-secondary);">
                    <th>Date</th>
                    <th>Type</th>
                    <th style="text-align:right;">Amount (₹)</th>
                    <th style="text-align:right;">Interest (₹)</th>
                    <th style="text-align:right;">Principal (₹)</th>
                    <th style="text-align:right;">Bal Principal (₹)</th>
                    <th style="text-align:center;width:75px;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${txns.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:14px;">No payment transactions recorded yet.</td></tr>' : txns.map(t => `
                    <tr>
                      <td>${this._escape(t.transaction_date)}</td>
                      <td><span class="badge badge-secondary">${this._escape(t.transaction_type)}</span></td>
                      <td style="text-align:right;font-weight:600;">₹${(t.amount || 0).toLocaleString('en-IN')}</td>
                      <td style="text-align:right;color:var(--danger);">₹${(t.interest_component || 0).toLocaleString('en-IN')}</td>
                      <td style="text-align:right;color:var(--success);">₹${(t.principal_component || 0).toLocaleString('en-IN')}</td>
                      <td style="text-align:right;">₹${(t.remaining_principal || 0).toLocaleString('en-IN')}</td>
                      <td style="text-align:center;">
                        ${t.transaction_type !== 'loan_disbursement' ? `
                          <button class="btn btn-xs undo-girvi-pay-btn" data-txn-id="${t.id}" title="Undo / Delete Payment" style="padding:2px 8px;font-size:11px;color:#c0392b;border:1px solid #e74c3c;border-radius:4px;background:#fdf2f2;cursor:pointer;font-weight:600;">
                            🗑️ Undo
                          </button>
                        ` : '<span style="color:var(--text-muted);font-size:11px;">Disbursed</span>'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="close-view-footer-btn">Close</button>
            <button class="btn" id="wa-from-view-btn" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:600;">📲 WhatsApp Reminder</button>
            <button class="btn btn-success" id="pay-from-view-btn" style="background:#27ae60;border-color:#27ae60;color:#fff;">💳 Record Payment</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('girvi-modals').innerHTML = modalHtml;

    const closeBtn = document.getElementById('close-view-modal-btn');
    const closeFooterBtn = document.getElementById('close-view-footer-btn');
    const waBtn = document.getElementById('wa-from-view-btn');
    const payBtn = document.getElementById('pay-from-view-btn');

    const closeModal = () => { document.getElementById('girvi-modals').innerHTML = ''; };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
    if (waBtn) {
      waBtn.addEventListener('click', () => {
        this.sendWhatsApp(loanId);
      });
    }
    if (payBtn) {
      payBtn.addEventListener('click', () => {
        closeModal();
        this._openPaymentModal(loanId);
      });
    }

    // Attach Undo Payment listeners
    document.querySelectorAll('.undo-girvi-pay-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const txnId = parseInt(btn.getAttribute('data-txn-id'), 10);
        if (!confirm('क्या आप इस भुगतान प्रविष्टि (Payment) को रद्द / Undo करना चाहते हैं?\n\nब्याज गणना की तारीख और बकाया राशि स्वचालित रूप से पहले जैसी हो जाएगी।')) {
          return;
        }

        try {
          btn.disabled = true;
          btn.textContent = 'Undoing...';
          await API.invoke('girvi:deletePayment', { transactionId: txnId, loanId });
          if (typeof Toast !== 'undefined') Toast.show('Payment reversed/undone successfully', 'success');
          // Re-open view modal to display updated dues and recalculated base date
          this._openViewModal(loanId);
          this.loadData();
        } catch (err) {
          alert(`Error reversing payment: ${err.message}`);
          btn.disabled = false;
          btn.textContent = '🗑️ Undo';
        }
      });
    });
  },

  async _openPaymentModal(loanId) {
    const loan = await API.invoke('girvi:getById', { id: loanId });
    if (!loan) return;

    const dues = loan.dues || {};

    const modalHtml = `
      <div class="modal-overlay active" id="girvi-pay-modal">
        <div class="modal" style="max-width:520px;width:95%;">
          <div class="modal-header">
            <h3>💳 Record Girvi Payment</h3>
            <button class="modal-close" id="close-pay-modal-btn">&times;</button>
          </div>
          <form id="girvi-payment-form">
            <div class="modal-body" style="padding:16px 20px;">
              <div style="background:var(--bg-body);padding:12px;border-radius:var(--radius);margin-bottom:14px;border:1px solid var(--border);">
                <div style="font-weight:700;font-size:14px;">${this._escape(loan.customer_name)} (Pledge #${this._escape(loan.loan_number)})</div>
                <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:13px;">
                  <span>Current Principal: <strong>₹${(dues.currentPrincipal || 0).toLocaleString('en-IN')}</strong></span>
                  <span>Interest Dues: <strong style="color:var(--danger)">₹${(dues.remainingInterest || 0).toLocaleString('en-IN')}</strong></span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:var(--text-muted);border-top:1px dashed var(--border);padding-top:4px;">
                  <span>Duration: <strong>${dues.monthsElapsed || 0}m ${dues.daysRemainder || 0}d</strong></span>
                  <span>Rate: <strong>${loan.monthly_interest_percent}% (${loan.interest_type === 'compound' ? 'चक्रवर्ती' : 'साधारण'})</strong></span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;">Payment Date *</label>
                <input type="date" id="p-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
              </div>

              <div class="form-group" style="margin-top:12px;">
                <label class="form-label" style="font-weight:600;">Total Payment Amount Received (₹) *</label>
                <input type="number" step="1" id="p-amount" class="form-control" required placeholder="e.g. 5000" value="${Math.round(dues.remainingInterest > 0 ? dues.remainingInterest : (dues.totalDues || 1000))}">
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
                <div>
                  <label class="form-label" style="font-weight:600;">Interest Amount (₹)</label>
                  <input type="number" step="1" id="p-interest" class="form-control" placeholder="Auto" value="${Math.round(dues.remainingInterest || 0)}">
                </div>
                <div>
                  <label class="form-label" style="font-weight:600;">Principal Amount (₹)</label>
                  <input type="number" step="1" id="p-principal" class="form-control" placeholder="Auto" value="0">
                </div>
              </div>

              <div style="font-size:11px;color:var(--success);margin-top:6px;font-weight:600;background:rgba(39, 174, 96, 0.08);padding:6px 10px;border-radius:6px;border:1px solid rgba(39, 174, 96, 0.2);">
                💡 ब्याज जमा करने पर ब्याज गणना की तारीख इस भुगतान दिनांक पर सेट हो जाएगी और मूलधन वैसा ही रहेगा।
              </div>

              <div class="form-group" style="margin-top:12px;">
                <label class="form-label" style="font-weight:600;">Payment Method</label>
                <select id="p-method" class="form-control">
                  <option value="cash">Cash (नकद)</option>
                  <option value="upi">UPI / Online (GPay / PhonePe / Paytm)</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div class="form-group" style="margin-top:12px;">
                <label class="form-label" style="font-weight:600;">Notes</label>
                <input type="text" id="p-notes" class="form-control" placeholder="e.g. Received via PhonePe">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cancel-pay-modal-btn">Cancel</button>
              <button type="submit" class="btn btn-success" id="save-pay-modal-btn">Save Payment</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('girvi-modals').innerHTML = modalHtml;

    const closeModal = () => { document.getElementById('girvi-modals').innerHTML = ''; };
    document.getElementById('close-pay-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-pay-modal-btn').addEventListener('click', closeModal);

    const amountInput = document.getElementById('p-amount');
    const interestInput = document.getElementById('p-interest');
    const principalInput = document.getElementById('p-principal');

    if (amountInput && interestInput && principalInput) {
      amountInput.addEventListener('input', () => {
        const total = parseFloat(amountInput.value) || 0;
        const interestDue = dues.remainingInterest || 0;
        if (total <= interestDue) {
          interestInput.value = total;
          principalInput.value = 0;
        } else {
          interestInput.value = Math.round(interestDue);
          principalInput.value = Math.round(total - interestDue);
        }
      });
    }

    const form = document.getElementById('girvi-payment-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('save-pay-modal-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
          const payload = {
            girvi_loan_id: loan.id,
            amount: parseFloat(amountInput.value) || 0,
            interest_component: parseFloat(interestInput.value) || 0,
            principal_component: parseFloat(principalInput.value) || 0,
            transaction_date: document.getElementById('p-date').value,
            payment_method: document.getElementById('p-method').value,
            notes: document.getElementById('p-notes').value.trim()
          };

          await API.invoke('girvi:recordPayment', payload);
          if (typeof Toast !== 'undefined') Toast.show('Girvi payment recorded successfully', 'success');
          closeModal();
          this.loadData();
        } catch (err) {
          alert(`Error recording payment: ${err.message}`);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Payment';
        }
      });
    }
  },

  async _confirmDelete(loanId) {
    const isHi = window.I18N && window.I18N.getLang() === 'hi';
    const loan = await API.invoke('girvi:getById', { id: loanId });
    if (!loan) return;

    const modalHtml = `
      <div class="modal-overlay active" id="girvi-delete-modal">
        <div class="modal" style="max-width:520px;width:95%;">
          <div class="modal-header" style="background:#fff5f5;border-bottom:1px solid #fed7d7;">
            <h3 style="color:#c53030;margin:0;">⚠️ ${isHi ? 'गिरवी रिकॉर्ड हटाएं (Delete Pledge Entry)' : 'Delete Girvi Pledge Entry'}</h3>
            <button class="modal-close" id="close-del-modal-btn">&times;</button>
          </div>
          <div class="modal-body" style="padding:18px 22px;">
            <div style="background:var(--bg-body);padding:12px 14px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;">
              <div style="font-weight:700;font-size:15px;color:var(--text);">${this._escape(loan.customer_name)}</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">
                Ticket: <strong>#${this._escape(loan.loan_number)}</strong> • Amount: <strong>₹${(loan.principal_amount || 0).toLocaleString('en-IN')}</strong> • Phone: <strong>${this._escape(loan.phone1)}</strong>
              </div>
            </div>

            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
              ${isHi ? 'कृपया चुनें कि आप इस रिकॉर्ड को कैसे हटाना चाहते हैं:' : 'Please choose how you want to delete this record:'}
            </p>

            <div style="display:flex;flex-direction:column;gap:10px;">
              <div style="border:1px solid var(--border);padding:12px;border-radius:8px;background:var(--bg-card);display:flex;align-items:flex-start;gap:10px;">
                <div style="font-size:22px;">📦</div>
                <div style="flex:1;">
                  <div style="font-weight:700;font-size:13px;">${isHi ? 'सामान्य डिलीट (Archive / Soft Delete)' : 'Archive / Soft Delete'}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                    ${isHi ? 'सक्रिय सूची से हटा दिया जाएगा। ऑडिट लॉग में सुरक्षित रहेगा।' : 'Removes from active view. Retained in system logs.'}
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-soft-delete" style="margin-top:8px;">
                    📦 ${isHi ? 'आर्काइव करें (Soft Delete)' : 'Archive (Soft Delete)'}
                  </button>
                </div>
              </div>

              <div style="border:1px solid #feb2b2;padding:12px;border-radius:8px;background:#fffaf0;display:flex;align-items:flex-start;gap:10px;">
                <div style="font-size:22px;">🔥</div>
                <div style="flex:1;">
                  <div style="font-weight:700;font-size:13px;color:#c53030;">${isHi ? 'स्थायी डिलीट (Permanent Owner Delete)' : 'Permanent Owner Delete'}</div>
                  <div style="font-size:12px;color:#742a2a;margin-top:2px;">
                    ${isHi ? 'डेटाबेस, बैकअप और सिंक से पूरी तरह हटा दिया जाएगा। यह वापस नहीं आ सकता!' : 'Completely removed from database, future backups, and cloud sync. Cannot be undone!'}
                  </div>
                  <button type="button" class="btn btn-danger btn-sm" id="btn-perm-delete" style="margin-top:8px;background:#e53e3e;border-color:#e53e3e;color:#fff;">
                    🔥 ${isHi ? 'स्थायी रूप से हटाएं (Permanent Delete)' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancel-del-modal-btn">${isHi ? 'रद्द करें (Cancel)' : 'Cancel'}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('girvi-modals').innerHTML = modalHtml;
    const closeModal = () => { document.getElementById('girvi-modals').innerHTML = ''; };

    document.getElementById('close-del-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('cancel-del-modal-btn')?.addEventListener('click', closeModal);

    document.getElementById('btn-soft-delete')?.addEventListener('click', async () => {
      try {
        await API.invoke('girvi:delete', { id: loanId });
        if (typeof Toast !== 'undefined') Toast.show(isHi ? 'गिरवी रिकॉर्ड आर्काइव किया गया' : 'Girvi entry archived', 'info');
        closeModal();
        this.loadData();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });

    document.getElementById('btn-perm-delete')?.addEventListener('click', async () => {
      if (!confirm(isHi ? 'चेतावनी: यह रिकॉर्ड हमेशा के लिए मिट जाएगा और वापस नहीं आएगा। क्या आप निश्चित हैं?' : 'WARNING: This record will be permanently deleted from database, backups, and sync. Are you sure?')) return;
      try {
        await API.invoke('girvi:permanentDelete', { id: loanId });
        if (typeof Toast !== 'undefined') Toast.show(isHi ? 'रिकॉर्ड स्थायी रूप से हटा दिया गया' : 'Record permanently deleted', 'success');
        closeModal();
        this.loadData();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  },


  _openImportModal() {
    const isHi = window.I18N && window.I18N.getLang() === 'hi';
    const modalHtml = `
      <div class="modal-overlay active" id="girvi-import-modal">
        <div class="modal" style="max-width:680px;width:95%;">
          <div class="modal-header">
            <h3>📥 ${isHi ? 'एक्सेल / CSV गिरवी डेटा इम्पोर्ट करें' : 'Import Legacy Girvi Excel / CSV'}</h3>
            <button class="modal-close" id="close-import-modal-btn">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px 24px;">
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px;line-height:1.5;">
              ${isHi 
                ? 'अपनी पुरानी गिरवी खाता एक्सेल शीट (.csv) अपलोड करें। सॉफ्टवेयर हिंदी एवं इंग्लिश कॉलम (<code>ग्राहक का नाम</code>, <code>जाति</code>, <code>रकम</code>, <code>सोना</code>, <code>दिनांक</code>, <code>व्याज</code>) स्वतः पहचान लेता है।'
                : 'Upload your legacy Girvi spreadsheet in CSV format. The importer automatically detects Hindi, Marathi & English column headers (<code>Customer Name</code>, <code>Caste</code>, <code>रकम</code>, <code>Gold Wt</code>, <code>Date</code>, <code>Rate</code>) and computes live dues.'}
            </p>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-size:12px; color:var(--text-muted);">Supported formats: <strong>.csv, .txt</strong> (Tally / Marg / Excel CSV)</span>
              <button class="btn btn-sm btn-secondary" id="download-template-btn" style="font-size:12px;">
                📥 ${isHi ? 'सैंपल CSV डाउनलोड करें' : 'Download Sample CSV Template'}
              </button>
            </div>

            <div style="border:2px dashed var(--border);padding:24px;text-align:center;border-radius:var(--radius);background:var(--bg-body);cursor:pointer;transition:border-color 0.2s;" id="drop-zone">
              <div style="font-size:36px;margin-bottom:8px;">📄</div>
              <div style="font-weight:700;font-size:14px;">${isHi ? 'फ़ाइल चुनने के लिए क्लिक करें या यहाँ ड्रैग करें' : 'Click to browse or Drag & Drop CSV File here'}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Comma, Semicolon, or Tab-separated CSV</div>
              <input type="file" id="girvi-file-input" accept=".csv,.txt" style="display:none;">
            </div>

            <div id="import-preview-container" style="margin-top:16px;display:none;">
              <h4 style="margin-bottom:8px;font-size:14px;">Preview (<span id="import-row-count">0</span> records detected)</h4>
              <div style="max-height:180px;overflow-y:auto;background:var(--bg-body);padding:10px;border-radius:var(--radius);font-size:12px;border:1px solid var(--border);" id="import-preview-list"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-import-btn">${isHi ? 'रद्द करें' : 'Cancel'}</button>
            <button class="btn btn-primary" id="start-import-btn" disabled>🚀 ${isHi ? 'सभी रिकॉर्ड्स इम्पोर्ट करें' : 'Import All Records'}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('girvi-modals').innerHTML = modalHtml;

    const closeBtn = document.getElementById('close-import-modal-btn');
    const cancelBtn = document.getElementById('cancel-import-btn');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('girvi-file-input');
    const startBtn = document.getElementById('start-import-btn');
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    const previewContainer = document.getElementById('import-preview-container');
    const previewList = document.getElementById('import-preview-list');
    const rowCount = document.getElementById('import-row-count');

    let loadedContent = null;

    const closeModal = () => { document.getElementById('girvi-modals').innerHTML = ''; };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Sample CSV Template Downloader
    if (downloadTemplateBtn) {
      downloadTemplateBtn.addEventListener('click', () => {
        const sampleCsv = `girvi_no,customer_name,father_husband_name,caste,phone1,address,loan_date,item_name,metal_type,gold_weight,silver_weight,principal_amount,monthly_interest_percent,reference_person,notes\r\nGIR-101,Ramesh Patel,Dattatray,Maratha,9822112233,Indapur,15/01/2026,Gold Chain 22K,gold,18.50,0.00,55000,2.0,Suresh Sheth,In original box\r\nGIR-102,Sunita Sharma,Jagdish,Brahmin,9833445566,Baramati,20/01/2026,Silver Payal 92.5%,silver,0.00,250.00,14000,2.5,Govind Jewellers,With bells\r\nGIR-103,Vijay Deshmukh,Baburao,Maratha,9855667788,Phaltan,05/02/2026,Gold Bangles (2),gold,32.00,0.00,95000,1.5,Maheshbhai,Hallmarked 916 KDM\r\nGIR-104,Anand Kumar,Ramchandra,Mali,9898989898,Pune,10/02/2026,Gold Ring & Silver Coin,mix,4.50,50.00,25000,2.0,Self,New customer`;
        const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'girvi_sample_template.csv';
        link.click();
      });
    }

    const processFile = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        loadedContent = evt.target.result;
        previewContainer.style.display = 'block';
        startBtn.disabled = false;
        const lines = loadedContent.split(/\r?\n/).filter(l => l.trim().length > 0);
        rowCount.textContent = Math.max(0, lines.length - 1);
        
        // Render rich preview rows
        const previewRows = lines.slice(0, 6).map((l, idx) => {
          if (idx === 0) {
            return `<div style="font-weight:700;color:var(--primary-dark);padding:4px 0;border-bottom:1px solid var(--border);">📋 Headers: ${this._escape(l)}</div>`;
          }
          return `<div style="padding:4px 0;border-bottom:1px dashed var(--border);color:var(--text-main);">Row ${idx}: ${this._escape(l)}</div>`;
        }).join('');
        previewList.innerHTML = previewRows;
      };
      reader.readAsText(file);
    };

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.background = 'var(--primary-light)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background = 'var(--bg-body)';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background = 'var(--bg-body)';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
      }
    });

    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.textContent = '⏳ Importing Records...';
      try {
        const res = await API.invoke('girvi:importExcel', { content: loadedContent });
        if (res.errorCount > 0 && res.successCount === 0) {
          alert(`⚠️ Import Error:\n${res.errors.slice(0, 3).join('\n')}`);
        } else {
          alert(`🎉 Successfully imported ${res.successCount} of ${res.totalRows} Girvi records into your ledger!`);
          closeModal();
          this.loadData();
        }
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      } finally {
        startBtn.disabled = false;
        startBtn.textContent = isHi ? '🚀 सभी रिकॉर्ड्स इम्पोर्ट करें' : 'Import All Records';
      }
    });
  },

  async sendWhatsApp(loanId) {
    try {
      const loan = await API.invoke('girvi:getById', { id: loanId });
      if (!loan) throw new Error('Loan record not found');
      if (!loan.phone1) throw new Error('No mobile number available for this customer');

      const dues = loan.dues || {};
      const durationFormatted = `${dues.monthsElapsed || 0}m ${dues.daysRemainder || 0}d`;

      const result = await API.invoke('communication:send', {
        customer_id: loan.customer_id || 1,
        recipient_number: loan.phone1,
        communication_type: 'whatsapp',
        message_type: 'girvi_reminder',
        loan_number: loan.loan_number,
        item_name: loan.item_name,
        principal_amount: loan.principal_amount,
        monthly_interest_percent: loan.monthly_interest_percent,
        total_dues: dues.totalDues || loan.principal_amount,
        duration: durationFormatted,
        dues
      });

      if (result && result.whatsappUrl) {
        this._showGirviWhatsAppPreview(loan, result);
      } else {
        alert('Failed: ' + (result?.error || 'Could not generate WhatsApp URL'));
      }
    } catch (err) {
      alert('WhatsApp error: ' + err.message);
    }
  },

  _showGirviWhatsAppPreview(loan, result) {
    const modalHost = document.getElementById('girvi-modals');
    if (!modalHost) return;

    const phone = result.cleanedPhone || loan.phone1 || '';
    const custName = loan.customer_name || 'Customer';

    modalHost.innerHTML = `
      <div class="modal-overlay active" id="girvi-wa-preview-modal">
        <div class="modal" style="max-width:560px;width:95%;">
          <div class="modal-header">
            <h2 style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:22px;">💬</span>
              <span>Send Girvi WhatsApp Notice</span>
            </h2>
            <button class="modal-close" id="girvi-wa-close">&times;</button>
          </div>
          <div class="modal-body" style="padding:16px 20px;">
            <div style="background:var(--bg-app);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-weight:700;font-size:15px;color:var(--text-primary);">👤 ${this._escape(custName)}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Ticket: <strong>#${this._escape(loan.loan_number)}</strong> | Phone: <strong style="color:var(--primary);">+${this._escape(phone)}</strong></div>
                </div>
                <div style="font-size:12px;background:#25D366;color:#fff;padding:4px 10px;border-radius:12px;font-weight:700;">WhatsApp Ready</div>
              </div>
            </div>

            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Notice Message (Review & Edit):</label>
                <button class="btn btn-xs btn-outline" id="girvi-wa-copy-btn" type="button" style="display:flex;align-items:center;gap:4px;">
                  📋 Copy Text
                </button>
              </div>
              <textarea id="girvi-wa-textarea" class="form-control" style="width:100%;height:180px;font-size:13px;line-height:1.45;font-family:inherit;padding:10px;resize:vertical;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);">${this._escape(result.message || '')}</textarea>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin:0;">
              💡 <strong>Tip:</strong> Choose <strong>Open in WhatsApp</strong> (desktop app or browser) or <strong>WhatsApp Web</strong>, or click <strong>Copy Text</strong> to paste directly into your chat.
            </p>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <button class="btn btn-secondary" id="girvi-wa-cancel" type="button">Close</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-outline" id="girvi-wa-web-btn" type="button" style="display:flex;align-items:center;gap:6px;">
                🌐 WhatsApp Web
              </button>
              <button class="btn btn-success" id="girvi-wa-app-btn" type="button" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:700;display:flex;align-items:center;gap:6px;">
                🚀 Open in WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalHost.innerHTML = ''; };
    document.getElementById('girvi-wa-close')?.addEventListener('click', close);
    document.getElementById('girvi-wa-cancel')?.addEventListener('click', close);

    document.getElementById('girvi-wa-copy-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('girvi-wa-textarea')?.value || '';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        const copyBtn = document.getElementById('girvi-wa-copy-btn');
        if (copyBtn) copyBtn.textContent = '✅ Copied!';
        setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copy Text'; }, 2000);
        if (typeof Toast !== 'undefined') Toast.show('Message copied to clipboard!', 'success');
      } catch (err) {
        alert('Copy failed: ' + err.message);
      }
    });

    document.getElementById('girvi-wa-web-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('girvi-wa-textarea')?.value || '';
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      try {
        await API.invoke('utils:openExternal', { url });
        if (typeof Toast !== 'undefined') Toast.show(`Opened WhatsApp Web for +${phone}`, 'success');
      } catch (err) {
        try {
          window.open(url, '_blank');
          if (typeof Toast !== 'undefined') Toast.show(`Opened WhatsApp Web for +${phone}`, 'success');
        } catch (e2) {
          alert('Failed to open WhatsApp Web: ' + err.message);
        }
      }
    });

    document.getElementById('girvi-wa-app-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('girvi-wa-textarea')?.value || '';
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      try {
        await API.invoke('utils:openExternal', { url });
        if (typeof Toast !== 'undefined') Toast.show(`Opened WhatsApp for +${phone}`, 'success');
      } catch (err) {
        try {
          window.open(url, '_blank');
          if (typeof Toast !== 'undefined') Toast.show(`Opened WhatsApp for +${phone}`, 'success');
        } catch (e2) {
          alert('Failed to open WhatsApp: ' + err.message);
        }
      }
    });
  },

  _escape(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

window.GIRVI_SCREEN = GIRVI_SCREEN;
