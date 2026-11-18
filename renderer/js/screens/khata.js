const KHATA_SCREEN = {
  _selectedCustomer: null,
  _customerSummary: null,
  _transactions: [],
  _pagination: null,
  _currentPage: 1,
  _sortColumn: 'transaction_date',
  _sortDirection: 'DESC',
  _customers: [],
  _customerPage: 1,
  _customerSearchTerm: '',
  _customerFilterMode: 'dues',
  _filterDateFrom: '',
  _filterDateTo: '',
  _filterPlace: '',
  _filterType: '',

  render() {
    return `
      <div class="khata-page">
        <div id="khata-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div id="khata-modal-container"></div>
      </div>
    `;
  },

  async init() {
    try {
      await this._reloadCustomersList();
      this._renderMainView();

      window.removeEventListener('customer-changed', this._onCustomerChanged);
      this._onCustomerChanged = () => this._reloadCustomersList().then(() => this._renderMainView()).catch(() => {});
      window.addEventListener('customer-changed', this._onCustomerChanged);
    } catch (err) {
      document.getElementById('khata-content').innerHTML = `<div class="alert alert-error">Failed to load: ${this._escape(err.message)}</div>`;
    }
  },

  async _reloadCustomersList() {
    if (this._customerFilterMode === 'all') {
      this._customers = await this._fetchAllCustomers();
    } else {
      this._customers = await this._fetchOutstandingCustomers();
    }
  },

  async _fetchOutstandingCustomers() {
    try {
      const outstanding = await API.invoke('khata:getOutstanding') || [];
      return outstanding;
    } catch {
      return [];
    }
  },

  async _fetchAllCustomers() {
    try {
      const all = await API.invoke('khata:getAllWithBalance') || [];
      return all;
    } catch {
      return [];
    }
  },

  async _searchCustomers(term) {
    try {
      const result = await API.invoke('customer:search', { search: term, pageSize: 100, is_archived: false, is_deleted: false });
      return result.data || [];
    } catch {
      return [];
    }
  },

  async _loadCustomerTransactions() {
    if (!this._selectedCustomer) return;
    try {
      const params = {
        customer_id: this._selectedCustomer.id,
        page: this._currentPage,
        pageSize: 25,
        sortColumn: this._sortColumn,
        sortDirection: this._sortDirection
      };
      if (this._filterDateFrom) params.date_from = this._filterDateFrom;
      if (this._filterDateTo) params.date_to = this._filterDateTo;
      if (this._filterType) params.transaction_type = this._filterType;

      const result = await API.invoke('khata:search', params);
      this._transactions = result.data || [];
      this._pagination = result.pagination;
    } catch (err) {
      this._transactions = [];
      this._pagination = null;
    }
  },

  async _loadCustomerSummary(id) {
    try {
      const summary = await API.invoke('customer:getSummary', { id });
      this._customerSummary = summary;
    } catch {
      this._customerSummary = null;
    }
  },

  _renderMainView() {
    const container = document.getElementById('khata-content');
    if (!container) return;

    container.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;">
        <h2>Khata / Ledger</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-outline" id="khata-print-list-btn" title="Print customer khata dues list (whole or place-wise)">🖨️ Print Khata List</button>
          <button class="btn btn-sm btn-secondary" id="khata-refresh-btn">🔄 Refresh Data</button>
        </div>
      </div>
      <div class="khata-layout">
        <div class="khata-sidebar">
          <div class="khata-mode-toggle" style="display:flex;gap:4px;margin-bottom:8px;">
            <button class="btn btn-xs ${this._customerFilterMode === 'dues' ? 'btn-primary' : 'btn-secondary'}" id="khata-mode-dues" style="flex:1">Dues Only</button>
            <button class="btn btn-xs ${this._customerFilterMode === 'all' ? 'btn-primary' : 'btn-secondary'}" id="khata-mode-all" style="flex:1">All Customers</button>
          </div>
          <div class="khata-customer-search">
            <input type="text" class="form-control" id="khata-cust-search" placeholder="Search customer (name/phone)..." autocomplete="off">
            <button class="btn btn-sm btn-primary" id="khata-cust-search-btn">Search</button>
          </div>
          <div class="khata-sidebar-info" style="font-size:12px;color:var(--text-muted);margin:4px 0 8px;">
            Showing ${this._customers.length} customer(s)
          </div>
          <div class="khata-customer-list" id="khata-customer-list">
            ${this._renderCustomerList()}
          </div>
        </div>
        <div class="khata-main">
          ${this._selectedCustomer ? this._renderCustomerView() : this._renderSelectPrompt()}
        </div>
      </div>
    `;
    this._bindMainEvents();
    if (this._selectedCustomer) {
      this._bindCustomerViewEvents();
      this._renderTransactions();
      this._renderPagination();
    }
  },

  _renderCustomerList() {
    if (this._customers.length === 0) {
      return '<div class="khata-no-customers">No customers with dues</div>';
    }
    return this._customers.map(c => `
      <div class="khata-customer-item ${this._selectedCustomer && this._selectedCustomer.id === c.customer_id ? 'active' : ''}"
           data-cid="${c.customer_id}" data-name="${this._escape(c.customer_name)}" data-phone="${this._escape(c.phone1 || '')}" data-relation="${this._escape(c.relation || '')}" data-city="${this._escape(c.city || '')}" data-address="${this._escape(c.address || '')}">
        <div style="flex:1;min-width:0;padding-right:8px;">
          <div class="khata-customer-item-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._escape(c.customer_name)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
            ${c.relation ? `<span>(${this._escape(c.relation)})</span>` : ''}
            ${c.city ? `<span>📍 ${this._escape(c.city)}</span>` : ''}
          </div>
        </div>
        <div class="khata-customer-item-balance ${c.balance > 0 ? 'due' : ''}" style="white-space:nowrap;">₹${(c.balance || 0).toFixed(2)}</div>
      </div>
    `).join('');
  },

  _renderSelectPrompt() {
    return `
      <div class="khata-select-prompt">
        <div class="khata-select-icon">📒</div>
        <h3>Select a Customer</h3>
        <p>Choose a customer to view their ledger and dues.</p>
      </div>
    `;
  },

  _renderCustomerView() {
    const c = this._selectedCustomer;
    const s = this._customerSummary;
    const pendingDues = s ? (s.pending_dues !== undefined ? s.pending_dues : Math.max(0, s.khata_balance || 0)) : Math.max(0, c.balance || 0);
    const advanceDeposit = s ? (s.advance_deposit || 0) : 0;
    const openingDues = s ? (s.opening_dues || 0) : 0;
    const receivedDues = s ? (s.received_dues || 0) : 0;
    const customerName = (s && s.name) || c.name || '';
    const relation = (s && s.relation) || c.relation || '';
    const city = (s && s.city) || c.city || '';
    const address = (s && s.address) || c.address || '';
    const phone = (s && s.phone1) || c.phone1 || '';

    return `
      <div class="khata-customer-header">
        <div class="khata-customer-header-top">
          <div class="khata-customer-info">
            <div class="khata-customer-avatar">${(customerName || 'U').charAt(0).toUpperCase()}</div>
            <div class="khata-customer-details">
              <h3 style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 4px 0;">
                <span>${this._escape(customerName)}</span>
                ${relation ? `<span style="font-size:14px;font-weight:normal;color:var(--text-muted);">(${this._escape(relation)})</span>` : ''}
              </h3>
              <div style="font-size:13px;color:var(--text-muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                ${city ? `<span>📍 <strong>${this._escape(city)}</strong></span>` : ''}
                ${city && phone ? `<span>|</span>` : ''}
                ${phone ? `<span>📞 ${this._escape(phone)}</span>` : ''}
                ${address && address !== city ? `<span>|</span><span title="${this._escape(address)}">🏠 ${this._escape(address)}</span>` : ''}
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
                <span>Opening: <strong>₹${Number(openingDues).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></span>
                <span style="margin:0 6px;">•</span>
                <span>Received: <strong>₹${Number(receivedDues).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <div class="khata-customer-balance ${pendingDues > 0 ? 'due' : 'clear'}" id="khata-pending-dues-box" style="text-align:right;">
              <div class="khata-balance-label" style="font-size:11px;font-weight:700;">PENDING DUES (बाकी)</div>
              <div class="khata-balance-value" style="font-size:20px;font-weight:800;">₹${Number(pendingDues).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            ${advanceDeposit > 0 ? `
              <div class="khata-customer-balance" id="khata-deposit-box" style="text-align:right;background:rgba(39,174,96,0.1);border:1px solid #27ae60;border-radius:var(--radius);padding:6px 12px;">
                <div style="font-size:11px;font-weight:700;color:#27ae60;">ADVANCE DEPOSIT (अमानत)</div>
                <div style="font-size:20px;font-weight:800;color:#27ae60;" id="khata-deposit-value">₹${Number(advanceDeposit).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="khata-customer-actions-row">
          <button class="khata-slide-arrow" id="khata-slide-left-btn" title="Slide Left" type="button">◀</button>
          <div class="khata-customer-actions" id="khata-customer-actions-bar">
            <button class="btn btn-primary" id="khata-receive-payment-btn">Receive Payment</button>
            ${pendingDues > 0 && (c.phone1 || c.phone2) ? `<button class="btn btn-sm btn-success" id="khata-direct-wa-btn" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:600;padding:6px 12px;font-size:12px;white-space:nowrap;" title="Send WhatsApp Dues Reminder">📲 WhatsApp</button>` : ''}
            ${APP_STATE.hasPermission('khata.adjust') ? '<button class="btn btn-secondary" id="khata-deposit-btn">Record Deposit</button>' : ''}
            <button class="btn btn-secondary" id="khata-create-bill-btn">+ Bill</button>
            <button class="btn btn-sm btn-secondary" id="khata-export-btn">Export</button>
            ${c.phone1 || c.phone2 ? `<div style="position:relative;display:inline-block">
              <button class="btn btn-sm btn-outline" id="khata-share-btn">Share</button>
              <div class="dropdown-menu" id="khata-share-dropdown" style="display:none;position:absolute;top:100%;right:0;z-index:100;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:200px;">
                <button class="dropdown-item" data-type="whatsapp" data-msg="khata_reminder">WhatsApp Reminder</button>
                <button class="dropdown-item" data-type="sms" data-msg="khata_reminder">SMS Reminder</button>
                <button class="dropdown-item" data-type="whatsapp" data-msg="invoice">WhatsApp Invoice</button>
              </div>
            </div>` : ''}
            ${APP_STATE.hasPermission('khata.adjust') ? '<button class="btn btn-sm btn-secondary" id="khata-opening-balance-btn">Opening</button>' : ''}
          </div>
          <button class="khata-slide-arrow" id="khata-slide-right-btn" title="Slide Right" type="button">▶</button>
        </div>
      </div>

      <div class="khata-filters">
        <div class="khata-filter-row">
          <input type="date" class="form-control khata-filter-date" id="khata-filter-from" value="${this._filterDateFrom}">
          <span class="khata-filter-sep">to</span>
          <input type="date" class="form-control khata-filter-date" id="khata-filter-to" value="${this._filterDateTo}">
          <select class="form-control khata-filter-select" id="khata-filter-type">
            <option value="">All Types</option>
            <option value="bill" ${this._filterType === 'bill' ? 'selected' : ''}>Bill</option>
            <option value="payment" ${this._filterType === 'payment' ? 'selected' : ''}>Payment</option>
            <option value="deposit" ${this._filterType === 'deposit' ? 'selected' : ''}>Deposit</option>
            <option value="opening_balance" ${this._filterType === 'opening_balance' ? 'selected' : ''}>Opening</option>
            <option value="adjustment_debit" ${this._filterType === 'adjustment_debit' ? 'selected' : ''}>Adjustment Dr</option>
            <option value="adjustment_credit" ${this._filterType === 'adjustment_credit' ? 'selected' : ''}>Adjustment Cr</option>
          </select>
          <button class="btn btn-sm btn-primary" id="khata-filter-apply">Apply</button>
          <button class="btn btn-sm btn-secondary" id="khata-filter-clear">Clear</button>
        </div>
      </div>

      <div class="khata-table-wrapper">
        <table class="data-table khata-table">
          <thead>
            <tr>
              <th class="sortable" data-col="transaction_date" onclick="window.KHATA_SCREEN._toggleSort('transaction_date')">Date ${this._sortIcon('transaction_date')}</th>
              <th class="sortable" data-col="transaction_type" onclick="window.KHATA_SCREEN._toggleSort('transaction_type')">Type ${this._sortIcon('transaction_type')}</th>
              <th>Reference</th>
              <th class="sortable" data-col="debit" onclick="window.KHATA_SCREEN._toggleSort('debit')">Debit ${this._sortIcon('debit')}</th>
              <th class="sortable" data-col="credit" onclick="window.KHATA_SCREEN._toggleSort('credit')">Credit ${this._sortIcon('credit')}</th>
              <th class="sortable" data-col="balance" onclick="window.KHATA_SCREEN._toggleSort('balance')">Balance ${this._sortIcon('balance')}</th>
              <th>Method</th>
              <th>Notes</th>
              <th style="width:120px">Actions</th>
            </tr>
          </thead>
          <tbody id="khata-tbody">
            <tr><td colspan="9"><div class="loading"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
      </div>
      <div id="khata-pagination"></div>
    `;
  },

  async _refreshTransactions() {
    if (!this._selectedCustomer) return;
    await Promise.all([
      this._loadCustomerTransactions(),
      this._loadCustomerSummary(this._selectedCustomer.id)
    ]);
    this._renderTransactions();
    this._renderPagination();
    const balanceVal = document.querySelector('.khata-balance-value');
    if (balanceVal && this._customerSummary) {
      const s = this._customerSummary;
      const pDues = s.pending_dues !== undefined ? s.pending_dues : Math.max(0, s.khata_balance || 0);
      balanceVal.textContent = '₹' + Number(pDues).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      balanceVal.closest('.khata-customer-balance')?.classList.toggle('due', pDues > 0);

      const depVal = document.getElementById('khata-deposit-value');
      const depBox = document.getElementById('khata-deposit-box');
      const advDeposit = Number(s.advance_deposit || 0);
      if (depVal) {
        depVal.textContent = '₹' + advDeposit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (depBox) {
        depBox.style.display = advDeposit > 0 ? 'block' : 'none';
      }
    }
  },

  _renderTransactions() {
    const tbody = document.getElementById('khata-tbody');
    if (!tbody) return;

    if (this._transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No transactions found</td></tr>';
      return;
    }

    tbody.innerHTML = this._transactions.map(t => {
      const date = t.transaction_date ? new Date(t.transaction_date + 'T00:00:00').toLocaleDateString('en-IN') : '';
      const typeLabel = this._transactionTypeLabel(t.transaction_type);
      const ref = t.bill_id ? `<a href="javascript:void(0)" class="khata-bill-link" data-txn-id="${t.id}" data-bill-id="${t.bill_id}">Bill #${t.bill_id}</a>` : (t.payment_id ? `Payment #${t.payment_id}` : '-');
      const isSource = t.data_source === 'migrated';
      const canEdit = t.transaction_type === 'payment' || t.transaction_type === 'deposit' || t.transaction_type === 'refund' || t.transaction_type === 'adjustment_debit' || t.transaction_type === 'adjustment_credit' || t.transaction_type === 'opening_balance';
      const canDelete = t.transaction_type === 'payment' || t.transaction_type === 'deposit' || t.transaction_type === 'refund' || t.transaction_type === 'adjustment_debit' || t.transaction_type === 'adjustment_credit' || t.transaction_type === 'opening_balance' || t.transaction_type === 'bill';
      const actions = t.bill_id ? `
        <div class="cell-actions">
          ${canDelete ? `<button class="btn btn-sm btn-danger khata-delete-txn" data-txn-id="${t.id}" data-type="${t.transaction_type}">×</button>` : ''}
          <button class="btn btn-sm btn-secondary khata-view-bill" data-txn-id="${t.id}" data-bill-id="${t.bill_id}">View</button>
          <button class="btn btn-sm btn-secondary khata-print-bill" data-bill-id="${t.bill_id}">Print</button>
        </div>
      ` : (canEdit ? `
        <div class="cell-actions">
          <button class="btn btn-sm btn-secondary khata-print-txn" data-txn-id="${t.id}" data-type="${t.transaction_type}">Print</button>
          <button class="btn btn-sm btn-secondary khata-edit-txn" data-txn-id="${t.id}" data-type="${t.transaction_type}">Edit</button>
          ${canDelete ? `<button class="btn btn-sm btn-danger khata-delete-txn" data-txn-id="${t.id}" data-type="${t.transaction_type}">×</button>` : ''}
        </div>
      ` : '');
      return `
        <tr class="${isSource ? 'row-migrated' : ''}">
          <td class="text-muted">${date}</td>
          <td><span class="khata-type khata-type-${t.transaction_type}">${this._escape(typeLabel)}</span></td>
          <td>${ref}</td>
          <td class="khata-amt khata-debit">${t.debit > 0 ? '₹' + Number(t.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</td>
          <td class="khata-amt khata-credit">${t.credit > 0 ? '₹' + Number(t.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</td>
          <td class="khata-amt khata-bal">₹${Number(t.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-muted">${this._escape(t.payment_method || '')}</td>
          <td class="text-muted khata-notes">${this._escape(t.notes || '')}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
    tbody.querySelectorAll('.khata-view-bill, .khata-bill-link').forEach(el => {
      el.addEventListener('click', (e) => {
        const billId = parseInt(e.target.dataset.billId);
        if (billId) this._showBillDetail(billId);
      });
    });
    tbody.querySelectorAll('.khata-print-bill').forEach(el => {
      el.addEventListener('click', async (e) => {
        const billId = parseInt(e.target.dataset.billId);
        if (billId) {
          try {
            const bill = await API.invoke('bill:getById', { id: billId });
            if (bill) {
              this._printBillPreview(bill);
            } else {
              this._showToast('Bill not found', 'error');
            }
          } catch (err) {
            this._showToast('Failed to print: ' + err.message, 'error');
          }
        }
      });
    });
    tbody.querySelectorAll('.khata-print-txn').forEach(el => {
      el.addEventListener('click', (e) => {
        const txnId = parseInt(e.target.dataset.txnId);
        const type = e.target.dataset.type;
        const txn = this._transactions.find(t => t.id === txnId);
        if (!txn) return;
        if (type === 'payment') {
          const c = this._selectedCustomer || {};
          this._printPaymentReceipt({
            amount: txn.credit || 0,
            payment_method: txn.payment_method || 'cash',
            payment_date: txn.transaction_date || new Date().toISOString().split('T')[0],
            notes: txn.notes || undefined,
            customerName: c.name,
            newBalance: txn.balance,
            billInvoice: txn.bill_id ? 'Bill #' + txn.bill_id : undefined
          });
        } else if (type === 'deposit' || type === 'refund') {
          this._printDepositReceipt({
            amount: type === 'refund' ? (txn.debit || 0) : (txn.credit || 0),
            type: type === 'refund' ? 'reduce' : 'add',
            notes: txn.notes || undefined,
            reason: type === 'refund' ? 'refund' : undefined,
            customerName: (this._selectedCustomer || {}).name,
            newBalance: txn.balance
          });
        }
      });
    });
    tbody.querySelectorAll('.khata-edit-txn').forEach(el => {
      el.addEventListener('click', (e) => {
        const txnId = parseInt(e.target.dataset.txnId);
        const type = e.target.dataset.type;
        const txn = this._transactions.find(t => t.id === txnId);
        if (txn) this._showEditTransactionModal(txn);
      });
    });
    tbody.querySelectorAll('.khata-delete-txn').forEach(el => {
      el.addEventListener('click', (e) => {
        const txnId = parseInt(e.target.dataset.txnId);
        const txn = this._transactions.find(t => t.id === txnId);
        if (txn) this._confirmDeleteTransaction(txn);
      });
    });
  },

  async _showBillDetail(billId) {
    try {
      const bill = await API.invoke('bill:getById', { id: billId });
      if (!bill) { Toast.show('Bill not found', 'error'); return; }
      this._renderBillDetailModal(bill);
    } catch (err) {
      Toast.show('Failed to load bill: ' + err.message, 'error');
    }
  },

  _renderBillDetailModal(bill) {
    const container = document.getElementById('khata-modal-container');
    const items = bill.items || [];
    const settings = bill.settings || {};
    container.innerHTML = `
      <div class="modal-overlay" id="bill-detail-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2>${this._escape(bill.invoice_number)}</h2>
            <button class="modal-close" id="bill-detail-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="detail-header">
              <div class="detail-avatar">${(bill.customer_name || 'U').charAt(0).toUpperCase()}</div>
              <div>
                <h3>${this._escape(bill.customer_name || 'Walk-in Customer')}</h3>
                <p class="text-muted">${this._escape(bill.customer_phone || '')} | ${this._escape(bill.bill_type || '').toUpperCase()}</p>
              </div>
              <div style="margin-left:auto;text-align:right">
                <div style="font-size:22px;font-weight:700;color:var(--primary)">₹${(bill.grand_total || 0).toFixed(2)}</div>
                <div class="text-muted" style="font-size:13px">${bill.bill_date || ''} | ${this._escape(bill.payment_status || '')}</div>
              </div>
            </div>
            <table class="data-table" style="font-size:13px">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Metal</th>
                  <th>Wt</th>
                  <th class="amt">Rate</th>
                  <th class="amt">Qty</th>
                  <th class="amt">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${this._escape(item.description || item.product_name || 'Item')}</td>
                    <td>${item.metal || ''} ${item.purity || ''}</td>
                    <td>${item.gross_weight || '-'}</td>
                    <td class="amt">₹${(item.rate || 0).toFixed(2)}</td>
                    <td class="amt">${item.quantity || 1}</td>
                    <td class="amt">₹${(item.total || 0).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="bill-summary-grid" style="margin-top:16px">
              <div class="bill-summary-row"><span>Subtotal</span><span>₹${(bill.subtotal || 0).toFixed(2)}</span></div>
              <div class="bill-summary-row"><span>Making Charges</span><span>₹${(bill.making_charge_total || 0).toFixed(2)}</span></div>
              ${bill.bill_type === 'gst' ? `<div class="bill-summary-row"><span>Wastage</span><span>₹${(bill.wastage_total || 0).toFixed(2)}</span></div>` : ''}
              <div class="bill-summary-row"><span>Discount</span><span>₹${(bill.discount_amount || 0).toFixed(2)}</span></div>
              ${bill.bill_type === 'gst' ? `
                <div class="bill-summary-row"><span>Taxable</span><span>₹${(bill.taxable_amount || 0).toFixed(2)}</span></div>
                <div class="bill-summary-row"><span>CGST (${(bill.cgst_rate || 0).toFixed(2)}%)</span><span>₹${(bill.cgst_amount || 0).toFixed(2)}</span></div>
                <div class="bill-summary-row"><span>SGST (${(bill.sgst_rate || 0).toFixed(2)}%)</span><span>₹${(bill.sgst_amount || 0).toFixed(2)}</span></div>
              ` : ''}
              <div class="bill-summary-row"><span>Round Off</span><span>${(bill.round_off || 0) >= 0 ? '+' : ''}${(bill.round_off || 0).toFixed(2)}</span></div>
              <div class="bill-summary-row bill-summary-total"><span>Grand Total</span><span>₹${(bill.grand_total || 0).toFixed(2)}</span></div>
            </div>
            <div style="margin-top:12px;font-size:13px">
              <span>Payment: <strong>${this._escape(bill.payment_status)}</strong></span>
              ${bill.paid_amount > 0 ? ` | Paid: ₹${(bill.paid_amount || 0).toFixed(2)}` : ''}
              ${bill.balance_amount > 0 ? ` | Due: ₹${(bill.balance_amount || 0).toFixed(2)}` : ''}
            </div>
            ${bill.notes ? `<div style="margin-top:8px;font-size:13px;color:var(--text-muted)">Notes: ${this._escape(bill.notes)}</div>` : ''}
          </div>
          <div class="modal-footer" style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="bill-detail-print-btn">Print</button>
            ${bill.customer_phone ? `<button class="btn btn-secondary" id="bill-detail-send-customer-btn">Send to Customer</button>` : ''}
            <button class="btn btn-secondary" id="bill-detail-send-owner-btn">Send to Owner</button>
            <button class="btn btn-secondary" style="margin-left: auto;" id="bill-detail-close-btn">Close</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('bill-detail-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('bill-detail-close-btn').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'bill-detail-modal') container.innerHTML = ''; });
    document.getElementById('bill-detail-print-btn').addEventListener('click', () => this._printBillPreview(bill));
    
    document.getElementById('bill-detail-send-customer-btn')?.addEventListener('click', async () => {
      const customerObj = { id: bill.customer_id, name: bill.customer_name, phone1: bill.customer_phone };
      try {
        await this._sendCommunication(customerObj, 'whatsapp', 'invoice', bill.id);
        this._showToast('WhatsApp opened to Send to Customer', 'success');
      } catch (err) {
        this._showToast('Failed to send to customer: ' + err.message, 'error');
      }
    });

    document.getElementById('bill-detail-send-owner-btn')?.addEventListener('click', async () => {
      try {
        const settings = await API.invoke('settings:get').catch(() => ({}));
        const ownerPhone = settings.phone || '';
        if (!ownerPhone) {
          this._showToast('Store phone number is not set in Settings', 'error');
          return;
        }
        const customerName = bill.customer_name || 'Walk-in Customer';
        const msg = `Store Notification: Bill ${bill.invoice_number} created for ${customerName}. Total: ₹${(bill.grand_total || 0).toFixed(2)}. Paid: ₹${(bill.paid_amount || 0).toFixed(2)}. Balance: ₹${(bill.balance_amount || 0).toFixed(2)}.`;
        
        const cleaned = ownerPhone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
        const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`;
        await API.invoke('utils:openExternal', { url });
        this._showToast('WhatsApp opened to Send to Owner', 'success');
      } catch (err) {
        try {
          window.open(url, '_blank');
          this._showToast('WhatsApp opened to Send to Owner', 'success');
        } catch (e2) {
          this._showToast('Failed to send to owner: ' + err.message, 'error');
        }
      }
    });
  },

  async _printBillPreview(bill) {
    const settings = await API.invoke('settings:get').catch(() => ({}));
    const items = (bill.items || []).map(item => ({
      description: item.description || item.product_name || 'Item',
      hsn_code: item.hsn_code || '',
      metal: item.metal || '',
      purity: item.purity || '',
      gross_weight: item.gross_weight || '',
      rate: item.rate || 0,
      qty: item.quantity || 1,
      making: item.making_charge || 0,
      wastageAmt: item.wastage_amount || 0,
      lineTotal: (item.rate || 0) * (item.quantity || 1)
    }));
    const halfGst = bill.bill_type === 'gst' ? (bill.cgst_rate || 1.5).toFixed(2) : '0.00';
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(`
      <!DOCTYPE html><html><head>
      <title>Invoice - ${bill.invoice_number}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .invoice { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #333; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .sub { font-size: 12px; color: #666; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 16px; }
        .info-box { width: 48%; }
        .info-box h3 { font-size: 14px; margin: 0 0 4px; color: #666; }
        .info-box p { margin: 2px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f5f5f5; padding: 8px; text-align: left; font-size: 12px; border-bottom: 2px solid #ddd; }
        td { padding: 8px; font-size: 13px; border-bottom: 1px solid #eee; }
        .amt { text-align: right; }
        .totals { width: 300px; margin-left: auto; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .totals-total { font-weight: bold; font-size: 16px; border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; }
        .payment-info { margin-top: 16px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 13px; }
        .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #999; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style></head><body>
      <div class="invoice">
        <div class="header">
          <h1>${settings.shop_name || 'Jwellers Edith'}</h1>
          <div class="sub">${settings.address || ''}${settings.city ? ', ' + settings.city : ''}${settings.phone ? ' | Ph: ' + settings.phone : ''}</div>
          <div class="sub">${settings.gst_number ? 'GST: ' + settings.gst_number : ''}</div>
        </div>
        <div class="info-row">
          <div class="info-box">
            <h3>Bill To</h3>
            <p><strong>${this._escape(bill.customer_name || 'Walk-in Customer')}</strong></p>
            <p>${this._escape(bill.customer_phone || '')}</p>
          </div>
          <div class="info-box" style="text-align:right">
            <h3>Invoice</h3>
            <p><strong>${bill.invoice_number}</strong></p>
            <p>Date: ${bill.bill_date || ''}</p>
            <p>Type: ${(bill.bill_type || '').toUpperCase()}</p>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Description</th>
            ${bill.bill_type === 'gst' ? '<th>HSN</th>' : ''}
            <th>Metal/Purity</th><th>Wt</th><th>Rate</th><th>Qty</th><th>Mkg</th>
            ${bill.bill_type === 'gst' ? '<th>Wstg</th>' : ''}
            <th class="amt">Total</th>
          </tr></thead>
          <tbody>
            ${items.map((row, i) => `<tr>
              <td>${i + 1}</td>
              <td>${this._escape(row.description || 'Item')}</td>
              ${bill.bill_type === 'gst' ? `<td>${row.hsn_code || '-'}</td>` : ''}
              <td>${row.metal} ${row.purity}</td>
              <td>${row.gross_weight || '-'}</td>
              <td class="amt">₹${row.rate.toFixed(2)}</td>
              <td class="amt">${row.qty}</td>
              <td class="amt">₹${row.making.toFixed(2)}</td>
              ${bill.bill_type === 'gst' ? `<td class="amt">₹${row.wastageAmt.toFixed(2)}</td>` : ''}
              <td class="amt">₹${row.lineTotal.toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>₹${(bill.subtotal || 0).toFixed(2)}</span></div>
          <div class="totals-row"><span>Making Charges</span><span>₹${(bill.making_charge_total || 0).toFixed(2)}</span></div>
          ${bill.bill_type === 'gst' ? `<div class="totals-row"><span>Wastage</span><span>₹${(bill.wastage_total || 0).toFixed(2)}</span></div>` : ''}
          <div class="totals-row"><span>Discount</span><span>₹${(bill.discount_amount || 0).toFixed(2)}</span></div>
          ${bill.bill_type === 'gst' ? `
          <div class="totals-row"><span>Taxable Amount</span><span>₹${(bill.taxable_amount || 0).toFixed(2)}</span></div>
          <div class="totals-row"><span>CGST (${(bill.cgst_rate || 0).toFixed(2)}%)</span><span>₹${(bill.cgst_amount || 0).toFixed(2)}</span></div>
          <div class="totals-row"><span>SGST (${(bill.sgst_rate || 0).toFixed(2)}%)</span><span>₹${(bill.sgst_amount || 0).toFixed(2)}</span></div>
          ` : ''}
          <div class="totals-row"><span>Round Off</span><span>${(bill.round_off || 0) >= 0 ? '+' : ''}${(bill.round_off || 0).toFixed(2)}</span></div>
          <div class="totals-row totals-total"><span>Grand Total</span><span>₹${(bill.grand_total || 0).toFixed(2)}</span></div>
        </div>
        <div class="payment-info">
          <p>Payment: <strong>${this._escape(bill.payment_status)}</strong>
          ${bill.paid_amount > 0 ? ` | Paid: ₹${(bill.paid_amount || 0).toFixed(2)}` : ''}
          ${bill.balance_amount > 0 ? ` | Due: ₹${(bill.balance_amount || 0).toFixed(2)}` : ''}</p>
        </div>
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>${settings.shop_name || ''}</p>
        </div>
        <div class="no-print" style="text-align:center;margin-top:20px">
          <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer">Print</button>
          <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer">Close</button>
        </div>
      </div>
      </body></html>
    `);
    w.document.close();
  },

  async _printPaymentReceipt(data) {
    const settings = await API.invoke('settings:get').catch(() => ({}));
    const c = this._selectedCustomer || {};
    const w = window.open('', '_blank', 'width=700,height=600');
    w.document.write(`
      <!DOCTYPE html><html><head>
      <title>Payment Receipt</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .receipt { max-width: 500px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #333; }
        .header h1 { margin: 0; font-size: 20px; }
        .header .sub { font-size: 11px; color: #666; }
        .label { color: #666; font-size: 12px; margin: 0; }
        .value { font-size: 15px; margin: 2px 0 12px; font-weight: bold; }
        .amount-box { text-align: center; margin: 16px 0; padding: 16px; background: #f0f8f0; border-radius: 6px; }
        .amount-box .amt { font-size: 28px; font-weight: bold; color: #27ae60; }
        .amount-box .lbl { font-size: 11px; color: #666; }
        .details { margin: 16px 0; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
        .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #999; padding-top: 12px; border-top: 1px solid #ddd; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style></head><body>
      <div class="receipt">
        <div class="header">
          <h1>${this._escape(settings.shop_name || 'Jwellers Edith')}</h1>
          <div class="sub">${settings.address || ''}${settings.city ? ', ' + settings.city : ''}${settings.phone ? ' | Ph: ' + settings.phone : ''}</div>
          <div class="sub">Payment Receipt</div>
        </div>
        <div class="amount-box">
          <div class="lbl">Amount Received</div>
          <div class="amt">₹${data.amount.toFixed(2)}</div>
        </div>
        <div class="details">
          <div class="row"><span class="label">Customer</span><span><strong>${this._escape(c.name || data.customerName || '')}</strong></span></div>
          <div class="row"><span class="label">Date</span><span>${data.payment_date || new Date().toLocaleDateString('en-IN')}</span></div>
          <div class="row"><span class="label">Payment Method</span><span>${data.payment_method || 'Cash'}</span></div>
          ${data.reference_number ? `<div class="row"><span class="label">Reference</span><span>${this._escape(data.reference_number)}</span></div>` : ''}
          ${data.notes ? `<div class="row"><span class="label">Notes</span><span>${this._escape(data.notes)}</span></div>` : ''}
          ${data.bill_id ? `<div class="row"><span class="label">Bill Linked</span><span>${this._escape(data.billInvoice || '#' + data.bill_id)}</span></div>` : ''}
          ${data.newBalance !== undefined ? `<div class="row" style="border-top:2px solid #333;margin-top:8px;padding-top:8px;font-weight:bold"><span>Balance After Payment</span><span>₹${data.newBalance.toFixed(2)}</span></div>` : ''}
        </div>
        <div class="footer">
          <p>Thank you for your payment!</p>
          <p>${settings.shop_name || ''}</p>
        </div>
        <div class="no-print" style="text-align:center;margin-top:16px">
          <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer">Print</button>
          <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer">Close</button>
        </div>
      </div>
      </body></html>
    `);
    w.document.close();
  },

  async _printDepositReceipt(data) {
    const settings = await API.invoke('settings:get').catch(() => ({}));
    const c = this._selectedCustomer || {};
    const isReduce = data.type === 'reduce';
    const title = isReduce ? 'Advance Deposit Refund / Reduction Voucher' : 'Advance Deposit Receipt (Jama)';
    const amountLbl = isReduce ? 'Amount Refunded / Reduced' : 'Deposit Amount Received';
    const amountColor = isReduce ? '#c0392b' : '#27ae60';
    const w = window.open('', '_blank', 'width=700,height=600');
    w.document.write(`
      <!DOCTYPE html><html><head>
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .receipt { max-width: 500px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #333; }
        .header h1 { margin: 0; font-size: 20px; }
        .header .sub { font-size: 11px; color: #666; }
        .label { color: #666; font-size: 12px; margin: 0; }
        .value { font-size: 15px; margin: 2px 0 12px; font-weight: bold; }
        .amount-box { text-align: center; margin: 16px 0; padding: 16px; background: ${isReduce ? '#fdedec' : '#f0f8f0'}; border-radius: 6px; }
        .amount-box .amt { font-size: 28px; font-weight: bold; color: ${amountColor}; }
        .amount-box .lbl { font-size: 11px; color: #666; }
        .details { margin: 16px 0; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
        .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #999; padding-top: 12px; border-top: 1px solid #ddd; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style></head><body>
      <div class="receipt">
        <div class="header">
          <h1>${this._escape(settings.shop_name || 'Jwellers Edith')}</h1>
          <div class="sub">${settings.address || ''}${settings.city ? ', ' + settings.city : ''}${settings.phone ? ' | Ph: ' + settings.phone : ''}</div>
          <div class="sub">${title}</div>
        </div>
        <div class="amount-box">
          <div class="lbl">${amountLbl}</div>
          <div class="amt">₹${data.amount.toFixed(2)}</div>
        </div>
        <div class="details">
          <div class="row"><span class="label">Customer</span><span><strong>${this._escape(c.name || data.customerName || '')}</strong></span></div>
          <div class="row"><span class="label">Date</span><span>${new Date().toLocaleDateString('en-IN')}</span></div>
          ${data.reason ? `<div class="row"><span class="label">Action Type</span><span><strong>${isReduce ? 'Reduction / Refund' : 'Deposit Add'}</strong></span></div>` : ''}
          ${data.notes ? `<div class="row"><span class="label">Notes / Narration</span><span>${this._escape(data.notes)}</span></div>` : ''}
          ${data.newBalance !== undefined ? `<div class="row" style="border-top:2px solid #333;margin-top:8px;padding-top:8px;font-weight:bold"><span>Net Ledger Balance</span><span>₹${data.newBalance.toFixed(2)}</span></div>` : ''}
        </div>
        <div class="footer">
          <p>${isReduce ? 'Deposit reduced successfully' : 'Deposit recorded successfully'}</p>
          <p>${settings.shop_name || ''}</p>
        </div>
        <div class="no-print" style="text-align:center;margin-top:16px">
          <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer">Print</button>
          <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer">Close</button>
        </div>
      </div>
      </body></html>
    `);
    w.document.close();
  },

  _showEditTransactionModal(txn) {
    const container = document.getElementById('khata-modal-container');
    const isPayment = txn.transaction_type === 'payment';
    const isAdjDebit = txn.transaction_type === 'adjustment_debit';
    const isAdjCredit = txn.transaction_type === 'adjustment_credit';
    const isOpeningBal = txn.transaction_type === 'opening_balance';
    const amount = isOpeningBal ? (txn.debit - txn.credit) : (isAdjDebit ? txn.debit : txn.credit);
    const title = isPayment ? 'Edit Payment' : (isOpeningBal ? 'Edit Opening Balance' : 'Edit Adjustment');

    container.innerHTML = `
      <div class="modal-overlay" id="edit-txn-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close" id="edit-txn-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="edit-txn-alert"></div>
            <form id="edit-txn-form" onsubmit="return false">
              ${isPayment ? `
              <div class="form-group">
                <label for="edit-txn-amount">Amount *</label>
                <input type="number" id="edit-txn-amount" class="form-control" step="0.01" value="${amount}" autofocus>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="edit-txn-date">Date</label>
                  <input type="date" id="edit-txn-date" class="form-control" value="${txn.transaction_date || new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                  <label for="edit-txn-method">Method</label>
                  <select id="edit-txn-method" class="form-control">
                    <option value="cash" ${(txn.payment_method || 'cash') === 'cash' ? 'selected' : ''}>Cash</option>
                    <option value="upi" ${txn.payment_method === 'upi' ? 'selected' : ''}>UPI</option>
                    <option value="card" ${txn.payment_method === 'card' ? 'selected' : ''}>Card</option>
                    <option value="other" ${txn.payment_method === 'other' ? 'selected' : ''}>Other</option>
                  </select>
                </div>
              </div>
              ` : (isOpeningBal ? `
              <div class="form-group">
                <label for="edit-txn-amount">Amount * <span class="text-muted">(positive = customer owes, negative = you owe customer)</span></label>
                <input type="number" id="edit-txn-amount" class="form-control" step="0.01" value="${amount}" autofocus>
              </div>
              <div class="form-group">
                <label for="edit-txn-date">Date</label>
                <input type="date" id="edit-txn-date" class="form-control" value="${txn.transaction_date || new Date().toISOString().split('T')[0]}">
              </div>
              ` : `
              <div class="form-group">
                <label for="edit-txn-amount">Amount *</label>
                <input type="number" id="edit-txn-amount" class="form-control" step="0.01" min="0.01" value="${amount}" autofocus>
              </div>
              <div class="form-group">
                <label for="edit-txn-date">Date</label>
                <input type="date" id="edit-txn-date" class="form-control" value="${txn.transaction_date || new Date().toISOString().split('T')[0]}">
              </div>
              `)}
              <div class="form-group">
                <label for="edit-txn-notes">Notes</label>
                <textarea id="edit-txn-notes" class="form-control" rows="2">${this._escape(txn.notes || '')}</textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="edit-txn-cancel">Cancel</button>
            <button class="btn btn-primary" id="edit-txn-save">Save Changes</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('edit-txn-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('edit-txn-cancel').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'edit-txn-modal') container.innerHTML = ''; });
    document.getElementById('edit-txn-save').addEventListener('click', async () => {
      const amountInput = document.getElementById('edit-txn-amount');
      const dateInput = document.getElementById('edit-txn-date');
      const notesInput = document.getElementById('edit-txn-notes');
      const methodInput = document.getElementById('edit-txn-method');
      const newAmount = parseFloat(amountInput.value);
      if (isNaN(newAmount) || (!isOpeningBal && newAmount <= 0)) {
        document.getElementById('edit-txn-alert').innerHTML = '<div class="alert alert-error">Please enter a valid amount</div>';
        return;
      }
      if (isOpeningBal && newAmount === 0) {
        document.getElementById('edit-txn-alert').innerHTML = '<div class="alert alert-error">Opening balance must not be zero</div>';
        return;
      }
      const btn = document.getElementById('edit-txn-save');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        const updateData = {
          amount: newAmount,
          transaction_date: dateInput.value || undefined,
          notes: notesInput.value.trim() || undefined
        };
        if (isPayment && methodInput) {
          updateData.payment_method = methodInput.value;
        }
        await API.invoke('khata:updateTransaction', { id: txn.id, data: updateData });
        container.innerHTML = '';
        Toast.show('Transaction updated', 'success');
        if (this._selectedCustomer) {
          await Promise.all([
            this._reloadCustomersList(),
            this._loadCustomerSummary(this._selectedCustomer.id),
            this._loadCustomerTransactions()
          ]);
          this._renderMainView();
          window.dispatchEvent(new CustomEvent('customer-changed'));
        }
      } catch (err) {
        document.getElementById('edit-txn-alert').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    });
  },

  _confirmDeleteTransaction(txn) {
    const container = document.getElementById('khata-modal-container');
    const typeLabel = this._transactionTypeLabel(txn.transaction_type);
    const amount = txn.debit > 0 ? txn.debit : txn.credit;
    const isBill = txn.transaction_type === 'bill';
    const isOpening = txn.transaction_type === 'opening_balance';
    let warning = 'This will recalculate all subsequent khata balances.';
    if (isBill) warning = 'This will cancel the associated bill and restore stock. All linked payments will also be removed.';
    if (isOpening) warning = 'This will remove the previous dues entry and recalculate all subsequent balances.';
    container.innerHTML = `
      <div class="modal-overlay" id="delete-txn-modal">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h2>Delete Transaction</h2>
            <button class="modal-close" id="delete-txn-close">&times;</button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to delete this ${typeLabel} of <strong>₹${amount.toFixed(2)}</strong>?</p>
            <p class="text-muted" style="font-size:13px;margin-top:8px">${warning}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="delete-txn-cancel">Cancel</button>
            <button class="btn btn-danger" id="delete-txn-confirm">Delete</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('delete-txn-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('delete-txn-cancel').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'delete-txn-modal') container.innerHTML = ''; });
    document.getElementById('delete-txn-confirm').addEventListener('click', async () => {
      const btn = document.getElementById('delete-txn-confirm');
      btn.disabled = true;
      btn.textContent = 'Deleting...';
      try {
        await API.invoke('khata:deleteTransaction', { id: txn.id });
        container.innerHTML = '';
        Toast.show('Transaction deleted', 'success');
        if (this._selectedCustomer) {
          await Promise.all([
            this._reloadCustomersList(),
            this._loadCustomerSummary(this._selectedCustomer.id),
            this._loadCustomerTransactions()
          ]);
          this._renderMainView();
          window.dispatchEvent(new CustomEvent('customer-changed'));
        } else {
          await this._reloadCustomersList();
          this._renderMainView();
        }
      } catch (err) {
        container.innerHTML = '';
        Toast.show('Failed to delete: ' + err.message, 'error');
      }
    });
  },

  _transactionTypeLabel(type) {
    const labels = {
      'bill': 'Bill',
      'payment': 'Payment',
      'deposit': 'Deposit',
      'opening_balance': 'Opening',
      'adjustment_debit': 'Adj Dr',
      'adjustment_credit': 'Adj Cr',
      'refund': 'Refund'
    };
    return labels[type] || type;
  },

  _renderPagination() {
    const el = document.getElementById('khata-pagination');
    if (!el) return;
    const p = this._pagination;
    if (!p || p.totalPages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="pagination">
        <span class="pagination-info">${p.total} entries — Page ${p.page} of ${p.totalPages}</span>
        <div class="pagination-btns">
          <button class="btn btn-sm btn-secondary" onclick="window.KHATA_SCREEN._goPage(1)" ${p.page <= 1 ? 'disabled' : ''}>First</button>
          <button class="btn btn-sm btn-secondary" onclick="window.KHATA_SCREEN._goPage(${p.page - 1})" ${!p.hasPrev ? 'disabled' : ''}>Prev</button>
          <button class="btn btn-sm btn-secondary" onclick="window.KHATA_SCREEN._goPage(${p.page + 1})" ${!p.hasNext ? 'disabled' : ''}>Next</button>
          <button class="btn btn-sm btn-secondary" onclick="window.KHATA_SCREEN._goPage(${p.totalPages})" ${p.page >= p.totalPages ? 'disabled' : ''}>Last</button>
        </div>
      </div>
    `;
  },

  _bindMainEvents() {
    document.getElementById('khata-print-list-btn')?.addEventListener('click', () => {
      this._showPrintKhataListModal();
    });

    document.getElementById('khata-refresh-btn')?.addEventListener('click', async () => {
      await this._reloadCustomersList();
      if (this._selectedCustomer) {
        await this._refreshTransactions();
      }
      this._renderMainView();
    });

    document.getElementById('khata-mode-dues')?.addEventListener('click', async () => {
      if (this._customerFilterMode !== 'dues') {
        this._customerFilterMode = 'dues';
        await this._reloadCustomersList();
        this._renderMainView();
      }
    });

    document.getElementById('khata-mode-all')?.addEventListener('click', async () => {
      if (this._customerFilterMode !== 'all') {
        this._customerFilterMode = 'all';
        await this._reloadCustomersList();
        this._renderMainView();
      }
    });

    document.getElementById('khata-cust-search-btn')?.addEventListener('click', () => this._doCustomerSearch());
    document.getElementById('khata-cust-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doCustomerSearch(); });
    document.getElementById('khata-cust-search')?.addEventListener('input', () => {
      if (!document.getElementById('khata-cust-search').value.trim()) {
        this._reloadCustomersList().then(() => this._renderMainView()).catch(() => {});
      }
    });

    document.querySelectorAll('.khata-customer-item').forEach(el => {
      el.addEventListener('click', () => {
        const cid = parseInt(el.dataset.cid);
        const name = el.dataset.name;
        const phone = el.dataset.phone;
        const relation = el.dataset.relation || '';
        const city = el.dataset.city || '';
        const address = el.dataset.address || '';
        this._selectCustomer({ id: cid, name, phone1: phone, relation, city, address });
      });
    });
  },

  async _doCustomerSearch() {
    const input = document.getElementById('khata-cust-search');
    const term = input.value.trim();
    if (!term) return;
    try {
      const customers = await this._searchCustomers(term);
      this._customers = customers.map(c => ({
        customer_id: c.id,
        customer_name: c.name,
        relation: c.relation || '',
        phone1: c.phone1 || '',
        city: c.city || '',
        address: c.address || '',
        balance: 0
      }));
      this._renderMainView();
    } catch (err) {
      this._renderMainView();
    }
  },

  async _selectCustomer(customer) {
    this._selectedCustomer = customer;
    this._currentPage = 1;
    this._filterDateFrom = '';
    this._filterDateTo = '';
    this._filterType = '';
    await Promise.all([
      this._loadCustomerSummary(customer.id),
      this._loadCustomerTransactions()
    ]);
    this._renderMainView();
    this._bindCustomerViewEvents();
  },

  _bindCustomerViewEvents() {
    const actionsEl = document.getElementById('khata-customer-actions-bar') || document.querySelector('.khata-customer-actions');
    const leftArrow = document.getElementById('khata-slide-left-btn');
    const rightArrow = document.getElementById('khata-slide-right-btn');

    if (actionsEl) {
      const updateArrowStates = () => {
        if (!leftArrow || !rightArrow) return;
        const hasOverflow = actionsEl.scrollWidth > actionsEl.clientWidth + 4;
        if (!hasOverflow) {
          leftArrow.style.display = 'none';
          rightArrow.style.display = 'none';
          return;
        }
        leftArrow.style.display = 'flex';
        rightArrow.style.display = 'flex';
        leftArrow.disabled = actionsEl.scrollLeft <= 4;
        rightArrow.disabled = actionsEl.scrollLeft + actionsEl.clientWidth >= actionsEl.scrollWidth - 6;
      };

      leftArrow?.addEventListener('click', (e) => {
        e.preventDefault();
        actionsEl.scrollBy({ left: -220, behavior: 'smooth' });
        setTimeout(updateArrowStates, 320);
      });

      rightArrow?.addEventListener('click', (e) => {
        e.preventDefault();
        actionsEl.scrollBy({ left: 220, behavior: 'smooth' });
        setTimeout(updateArrowStates, 320);
      });

      let isDown = false;
      let startX = 0;
      let scrollStart = 0;
      let isDragging = false;

      actionsEl.addEventListener('mousedown', (e) => {
        isDown = true;
        isDragging = false;
        startX = e.pageX - actionsEl.offsetLeft;
        scrollStart = actionsEl.scrollLeft;
        actionsEl.classList.add('grabbing');
      });

      window.addEventListener('mouseup', () => {
        if (isDown) {
          isDown = false;
          actionsEl.classList.remove('grabbing');
          updateArrowStates();
        }
      });

      actionsEl.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const x = e.pageX - actionsEl.offsetLeft;
        const walk = x - startX;
        if (Math.abs(walk) > 4) {
          isDragging = true;
          e.preventDefault();
          actionsEl.scrollLeft = scrollStart - (walk * 1.4);
          updateArrowStates();
        }
      });

      actionsEl.addEventListener('click', (e) => {
        if (isDragging) {
          e.preventDefault();
          e.stopPropagation();
          isDragging = false;
        }
      }, true);

      actionsEl.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0 || e.deltaX !== 0) {
          e.preventDefault();
          actionsEl.scrollLeft += (e.deltaY || e.deltaX);
          updateArrowStates();
        }
      }, { passive: false });

      actionsEl.addEventListener('scroll', updateArrowStates);
      setTimeout(updateArrowStates, 60);
      window.addEventListener('resize', updateArrowStates);
    }
    document.getElementById('khata-receive-payment-btn')?.addEventListener('click', () => this._showReceivePaymentModal());
    document.getElementById('khata-create-bill-btn')?.addEventListener('click', () => this._createBill());
    document.getElementById('khata-opening-balance-btn')?.addEventListener('click', () => this._showOpeningBalanceModal());
    document.getElementById('khata-deposit-btn')?.addEventListener('click', () => this._showDepositModal());
    document.getElementById('khata-filter-apply')?.addEventListener('click', () => {
      this._filterDateFrom = document.getElementById('khata-filter-from')?.value || '';
      this._filterDateTo = document.getElementById('khata-filter-to')?.value || '';
      this._filterType = document.getElementById('khata-filter-type')?.value || '';
      this._currentPage = 1;
      this._refreshTransactions();
    });
    document.getElementById('khata-filter-clear')?.addEventListener('click', () => {
      this._filterDateFrom = '';
      this._filterDateTo = '';
      this._filterType = '';
      this._currentPage = 1;
      document.getElementById('khata-filter-from').value = '';
      document.getElementById('khata-filter-to').value = '';
      document.getElementById('khata-filter-type').value = '';
      this._refreshTransactions();
    });

    document.getElementById('khata-export-btn')?.addEventListener('click', () => this._exportLedger());

    const directWaBtn = document.getElementById('khata-direct-wa-btn');
    if (directWaBtn) {
      directWaBtn.addEventListener('click', () => {
        const s = this._customerSummary;
        const c = this._selectedCustomer;
        const pendingDues = s ? (s.pending_dues !== undefined ? s.pending_dues : Math.max(0, s.khata_balance || 0)) : Math.max(0, c.balance || 0);
        this._sendCommunication(this._selectedCustomer, 'whatsapp', 'khata_reminder', null, null, pendingDues);
      });
    }

    const shareBtn = document.getElementById('khata-share-btn');
    const dropdown = document.getElementById('khata-share-dropdown');
    if (shareBtn && dropdown) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', () => { dropdown.style.display = 'none'; }, { once: false });
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          dropdown.style.display = 'none';
          const s = this._customerSummary;
          const c = this._selectedCustomer;
          const pendingDues = s ? (s.pending_dues !== undefined ? s.pending_dues : Math.max(0, s.khata_balance || 0)) : Math.max(0, c.balance || 0);
          this._sendCommunication(this._selectedCustomer, item.dataset.type, item.dataset.msg, null, null, pendingDues);
        });
      });
    }
  },

  async _sendCommunication(customer, commType, messageType, billId, paymentId, balanceAmount, recipientNumber = null) {
    const p1 = (customer.phone1 || '').trim();
    const p2 = (customer.phone2 || '').trim();

    // If customer has 2 distinct phone numbers and recipient not yet selected for WhatsApp, prompt user
    if (!recipientNumber && p1 && p2 && p1 !== p2 && commType === 'whatsapp') {
      const container = document.getElementById('khata-modal-container');
      if (container) {
        container.innerHTML = `
          <div class="modal-overlay" id="choose-phone-modal">
            <div class="modal" style="max-width:390px;width:95%;">
              <div class="modal-header">
                <h3>📲 Select WhatsApp Number</h3>
                <button class="modal-close" id="choose-phone-close">&times;</button>
              </div>
              <div class="modal-body" style="padding:18px;">
                <p style="margin-bottom:14px;font-size:13px;color:var(--text-muted);line-height:1.4;">
                  Customer <strong>${this._escape(customer.name)}</strong> has 2 phone numbers. Choose where to send WhatsApp message:
                </p>
                <div style="display:flex;flex-direction:column;gap:10px;">
                  <button class="btn btn-secondary" id="choose-p1-btn" style="padding:12px;text-align:left;display:flex;justify-content:space-between;align-items:center;border-radius:8px;">
                    <div>
                      <div style="font-weight:700;">📞 Phone 1 (Primary)</div>
                      <div style="font-size:12px;color:var(--text-muted);">${this._escape(p1)}</div>
                    </div>
                    <span style="font-size:18px;">💬</span>
                  </button>
                  <button class="btn btn-secondary" id="choose-p2-btn" style="padding:12px;text-align:left;display:flex;justify-content:space-between;align-items:center;border-radius:8px;">
                    <div>
                      <div style="font-weight:700;">📱 Phone 2 (Alternate)</div>
                      <div style="font-size:12px;color:var(--text-muted);">${this._escape(p2)}</div>
                    </div>
                    <span style="font-size:18px;">💬</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        document.getElementById('choose-phone-close')?.addEventListener('click', () => container.innerHTML = '');
        document.getElementById('choose-p1-btn')?.addEventListener('click', () => {
          container.innerHTML = '';
          this._sendCommunication(customer, commType, messageType, billId, paymentId, balanceAmount, p1);
        });
        document.getElementById('choose-p2-btn')?.addEventListener('click', () => {
          container.innerHTML = '';
          this._sendCommunication(customer, commType, messageType, billId, paymentId, balanceAmount, p2);
        });
        return;
      }
    }

    try {
      const result = await API.invoke('communication:send', {
        customer_id: customer.id,
        communication_type: commType,
        message_type: messageType,
        bill_id: billId || null,
        payment_id: paymentId || null,
        balance_amount: balanceAmount || null,
        recipient_number: recipientNumber || p1 || p2
      });
      if (result.success && result.whatsappUrl) {
        this._showWhatsAppPreviewModal(customer, result, { commType, messageType, billId, paymentId, balanceAmount });
      } else if (result.success && result.smsTo) {
        this._showToast(`SMS queued for ${result.smsTo}`, 'info');
      } else if (!result.success) {
        this._showToast('Failed: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      this._showToast('Communication failed: ' + err.message, 'error');
    }
  },

  _showWhatsAppPreviewModal(customer, result, meta = {}) {
    const container = document.getElementById('khata-modal-container');
    if (!container) return;

    const p1 = (customer.phone1 || '').trim();
    const p2 = (customer.phone2 || '').trim();
    const currentPhone = result.cleanedPhone || (customer.phone1 || customer.phone2 || '').trim();
    const custName = customer.name || 'Customer';

    let phoneSwitcherHtml = '';
    if (p1 && p2 && p1 !== p2) {
      phoneSwitcherHtml = `
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--text-muted);">Send to:</span>
          <button class="btn btn-xs ${currentPhone.endsWith(p1.slice(-10)) ? 'btn-primary' : 'btn-outline'}" id="wa-toggle-p1" type="button">📞 Phone 1 (${this._escape(p1)})</button>
          <button class="btn btn-xs ${currentPhone.endsWith(p2.slice(-10)) ? 'btn-primary' : 'btn-outline'}" id="wa-toggle-p2" type="button">📱 Phone 2 (${this._escape(p2)})</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="modal-overlay" id="whatsapp-preview-modal">
        <div class="modal" style="max-width:560px;width:95%;">
          <div class="modal-header">
            <h2 style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:22px;">💬</span>
              <span>Send WhatsApp Message</span>
            </h2>
            <button class="modal-close" id="wa-preview-close">&times;</button>
          </div>
          <div class="modal-body" style="padding:16px 20px;">
            <div style="background:var(--bg-app);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-weight:700;font-size:15px;color:var(--text-primary);">👤 ${this._escape(custName)}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Target Number: <strong style="color:var(--primary);">+${this._escape(currentPhone)}</strong></div>
                </div>
                <div style="font-size:12px;background:#25D366;color:#fff;padding:4px 10px;border-radius:12px;font-weight:700;">WhatsApp Ready</div>
              </div>
              ${phoneSwitcherHtml}
            </div>

            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Message Text (Review & Edit):</label>
                <button class="btn btn-xs btn-outline" id="wa-copy-btn" type="button" style="display:flex;align-items:center;gap:4px;">
                  📋 Copy Text
                </button>
              </div>
              <textarea id="wa-message-textarea" class="form-control" style="width:100%;height:180px;font-size:13px;line-height:1.45;font-family:inherit;padding:10px;resize:vertical;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);">${this._escape(result.message || '')}</textarea>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin:0;">
              💡 <strong>Tip:</strong> Choose <strong>Open in WhatsApp</strong> (app or browser) or <strong>WhatsApp Web</strong>, or click <strong>Copy Text</strong> to paste directly into your chat.
            </p>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <button class="btn btn-secondary" id="wa-preview-cancel" type="button">Close</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-outline" id="wa-open-web-btn" type="button" style="display:flex;align-items:center;gap:6px;">
                🌐 WhatsApp Web
              </button>
              <button class="btn btn-success" id="wa-open-app-btn" type="button" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:700;display:flex;align-items:center;gap:6px;">
                🚀 Open in WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => { container.innerHTML = ''; };
    document.getElementById('wa-preview-close')?.addEventListener('click', close);
    document.getElementById('wa-preview-cancel')?.addEventListener('click', close);
    container.addEventListener('click', e => { if (e.target.id === 'whatsapp-preview-modal') close(); });

    document.getElementById('wa-toggle-p1')?.addEventListener('click', () => {
      container.innerHTML = '';
      this._sendCommunication(customer, 'whatsapp', meta.messageType, meta.billId, meta.paymentId, meta.balanceAmount, p1);
    });
    document.getElementById('wa-toggle-p2')?.addEventListener('click', () => {
      container.innerHTML = '';
      this._sendCommunication(customer, 'whatsapp', meta.messageType, meta.billId, meta.paymentId, meta.balanceAmount, p2);
    });

    document.getElementById('wa-copy-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('wa-message-textarea')?.value || '';
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
        const copyBtn = document.getElementById('wa-copy-btn');
        if (copyBtn) copyBtn.textContent = '✅ Copied!';
        setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copy Text'; }, 2000);
        this._showToast('Message copied to clipboard! You can paste anywhere in WhatsApp.', 'success');
      } catch (err) {
        this._showToast('Failed to copy: ' + err.message, 'error');
      }
    });

    document.getElementById('wa-open-web-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('wa-message-textarea')?.value || '';
      const url = `https://web.whatsapp.com/send?phone=${currentPhone}&text=${encodeURIComponent(text)}`;
      try {
        await API.invoke('utils:openExternal', { url });
        this._showToast(`Opened WhatsApp Web for +${currentPhone}`, 'success');
      } catch (err) {
        try {
          window.open(url, '_blank');
          this._showToast(`Opened WhatsApp Web for +${currentPhone}`, 'success');
        } catch (e2) {
          this._showToast('Failed to open WhatsApp Web: ' + err.message, 'error');
        }
      }
    });

    document.getElementById('wa-open-app-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('wa-message-textarea')?.value || '';
      const url = `https://api.whatsapp.com/send?phone=${currentPhone}&text=${encodeURIComponent(text)}`;
      try {
        await API.invoke('utils:openExternal', { url });
        this._showToast(`Opened WhatsApp for +${currentPhone}`, 'success');
      } catch (err) {
        try {
          window.open(url, '_blank');
          this._showToast(`Opened WhatsApp for +${currentPhone}`, 'success');
        } catch (e2) {
          this._showToast('Failed to open WhatsApp: ' + err.message, 'error');
        }
      }
    });
  },

  _showReceivePaymentModal() {
    const c = this._selectedCustomer;
    if (!c) return;
    const balance = this._customerSummary ? this._customerSummary.khata_balance : 0;
    const container = document.getElementById('khata-modal-container');

    container.innerHTML = `
      <div class="modal-overlay" id="receive-payment-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Receive Payment</h2>
            <button class="modal-close" id="receive-payment-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="receive-payment-alert"></div>
            <p style="margin-bottom:16px">Customer: <strong>${this._escape(c.name)}</strong> | Dues: <strong>₹${balance.toFixed(2)}</strong></p>
            <form id="receive-payment-form" onsubmit="return false">
              <div class="form-group">
                <label for="rp-amount">Amount *</label>
                <input type="number" id="rp-amount" class="form-control" step="0.01" min="0.01" placeholder="Enter amount received" autofocus>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="rp-method">Payment Method</label>
                  <select id="rp-method" class="form-control">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="rp-date">Payment Date</label>
                  <input type="date" id="rp-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                </div>
              </div>
              <div class="form-group">
                <label for="rp-reference">Reference (UPI/Card/Cheque)</label>
                <input type="text" id="rp-reference" class="form-control" placeholder="Optional reference number">
              </div>
              <div class="form-group">
                <label for="rp-notes">Notes</label>
                <textarea id="rp-notes" class="form-control" rows="2" placeholder="Optional notes..."></textarea>
              </div>
              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="rp-link-bill">
                  <span>Link to a specific bill</span>
                </label>
              </div>
              <div id="rp-bill-select" style="display:none">
                <div class="form-group">
                  <label>Search Bill</label>
                  <input type="text" class="form-control" id="rp-bill-search" placeholder="Enter invoice number...">
                  <div id="rp-bill-results"></div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="receive-payment-cancel">Cancel</button>
            <button class="btn btn-primary" id="receive-payment-save">Record Payment</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('receive-payment-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('receive-payment-cancel').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'receive-payment-modal') container.innerHTML = ''; });

    document.getElementById('rp-link-bill')?.addEventListener('change', e => {
      document.getElementById('rp-bill-select').style.display = e.target.checked ? 'block' : 'none';
    });

    let billSearchTimeout;
    document.getElementById('rp-bill-search')?.addEventListener('input', e => {
      clearTimeout(billSearchTimeout);
      billSearchTimeout = setTimeout(() => this._searchBillsForPayment(e.target.value), 300);
    });

    document.getElementById('receive-payment-save').addEventListener('click', () => this._recordPayment());
  },

  _selectedBillForPayment: null,

  async _searchBillsForPayment(term) {
    const resultsDiv = document.getElementById('rp-bill-results');
    if (!resultsDiv || !term) { if (resultsDiv) resultsDiv.innerHTML = ''; return; }
    try {
      const result = await API.invoke('bill:search', {
        search: term,
        customer_id: this._selectedCustomer.id,
        status: 'active',
        pageSize: 10
      });
      const bills = result.data || [];
      if (bills.length === 0) { resultsDiv.innerHTML = '<div class="khata-search-hint">No active bills found</div>'; return; }
      resultsDiv.innerHTML = bills.map(b => `
        <div class="khata-bill-result" data-bid="${b.id}" data-balance="${b.balance_amount}" data-inv="${this._escape(b.invoice_number)}">
          ${this._escape(b.invoice_number)} — ₹${(b.balance_amount || 0).toFixed(2)} due
        </div>
      `).join('');
      resultsDiv.querySelectorAll('.khata-bill-result').forEach(el => {
        el.addEventListener('click', () => {
          this._selectedBillForPayment = { id: parseInt(el.dataset.bid), balance: parseFloat(el.dataset.balance), invoice: el.dataset.inv };
          document.getElementById('rp-bill-search').value = el.dataset.inv;
          resultsDiv.innerHTML = '';
        });
      });
    } catch { resultsDiv.innerHTML = '<div class="khata-search-hint">Error searching bills</div>'; }
  },

  async _recordPayment() {
    const amount = parseFloat(document.getElementById('rp-amount').value);
    if (!amount || amount <= 0) {
      document.getElementById('receive-payment-alert').innerHTML = '<div class="alert alert-error">Please enter a valid amount</div>';
      return;
    }

    const btn = document.getElementById('receive-payment-save');
    btn.disabled = true;
    btn.textContent = 'Recording...';

    try {
      const paymentData = {
        customer_id: this._selectedCustomer.id,
        amount,
        payment_method: document.getElementById('rp-method').value,
        payment_date: document.getElementById('rp-date').value || new Date().toISOString().split('T')[0],
        reference_number: document.getElementById('rp-reference').value.trim() || undefined,
        notes: document.getElementById('rp-notes').value.trim() || undefined
      };

      if (this._selectedBillForPayment) {
        paymentData.bill_id = this._selectedBillForPayment.id;
      }

      await API.invoke('payment:create', paymentData);

      const linkedBill = this._selectedBillForPayment ? { ...this._selectedBillForPayment } : null;
      document.getElementById('khata-modal-container').innerHTML = '';
      this._selectedBillForPayment = null;
      this._showToast('Payment of ₹' + amount.toFixed(2) + ' recorded', 'success');
      await Promise.all([
        this._loadCustomerSummary(this._selectedCustomer.id),
        this._refreshTransactions()
      ]);
      const newBalance = this._customerSummary ? this._customerSummary.khata_balance : undefined;
      this._printPaymentReceipt({
        ...paymentData,
        customerName: this._selectedCustomer.name,
        newBalance,
        billInvoice: linkedBill ? linkedBill.invoice : undefined
      });
      await this._reloadCustomersList();
      window.dispatchEvent(new CustomEvent('customer-changed'));
      this._renderMainView();
    } catch (err) {
      document.getElementById('receive-payment-alert').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Record Payment';
    }
  },

  _showDepositModal() {
    const c = this._selectedCustomer;
    if (!c) return;
    const s = this._customerSummary;
    const currentDeposit = s ? (s.advance_deposit || 0) : 0;
    const container = document.getElementById('khata-modal-container');

    container.innerHTML = `
      <div class="modal-overlay" id="deposit-modal">
        <div class="modal" style="max-width:480px;width:95%;">
          <div class="modal-header">
            <h2>💎 Manage Advance Deposit (अमानत जमा)</h2>
            <button class="modal-close" id="deposit-close">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <div id="deposit-alert"></div>

            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Current Available Deposit (मौजूदा अमानत)</div>
                <div style="font-size:22px;font-weight:800;color:#27ae60;margin-top:2px;">₹${Number(currentDeposit).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;font-size:14px;">${this._escape(c.name)}</div>
                <div style="font-size:12px;color:var(--text-muted);">${this._escape(c.phone1 || '')}</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
              <button type="button" class="btn btn-primary" id="btn-mode-add" style="padding:10px;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:3px;border-radius:8px;">
                <span style="font-size:15px;">➕ Add Deposit</span>
                <span style="font-size:11px;opacity:0.85;font-weight:normal;">जमा जोड़ें (Customer gives money)</span>
              </button>
              <button type="button" class="btn btn-secondary" id="btn-mode-reduce" style="padding:10px;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:3px;border-radius:8px;">
                <span style="font-size:15px;">➖ Reduce / Refund</span>
                <span style="font-size:11px;opacity:0.85;font-weight:normal;">जमा घटाएं / वापसी (Refund/Adjust)</span>
              </button>
            </div>

            <form id="deposit-form" onsubmit="return false">
              <input type="hidden" id="deposit-mode" value="add">

              <div class="form-group" style="margin-bottom:14px;">
                <label for="deposit-amount" style="font-weight:600;" id="deposit-amount-lbl">Amount to Add (जमा राशि ₹) *</label>
                <input type="number" id="deposit-amount" class="form-control" step="0.01" min="0.01" placeholder="Enter amount in ₹" autofocus>
                <div id="deposit-limit-hint" style="font-size:11px;color:var(--text-muted);margin-top:4px;display:none;">
                  Maximum reducible: <strong>₹${Number(currentDeposit).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                </div>
              </div>

              <div class="form-group" id="deposit-reason-group" style="display:none;margin-bottom:14px;">
                <label for="deposit-reason" style="font-weight:600;">Reason for Reducing (घटाने का कारण)</label>
                <select id="deposit-reason" class="form-control">
                  <option value="refund">Cash / UPI Refund to Customer (ग्राहक को नकद/यूपीआई वापसी)</option>
                  <option value="adjustment">Applied / Adjusted in Purchase (खरीदारी में समायोजित)</option>
                  <option value="cancelled">Order Cancelled (ऑर्डर रद्द)</option>
                  <option value="other">Other Adjustment (अन्य कारण)</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom:16px;">
                <label for="deposit-notes" style="font-weight:600;">Notes / Narration (विवरण)</label>
                <textarea id="deposit-notes" class="form-control" rows="2" placeholder="e.g. Advance booking for 22K gold bangle"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--border);">
            <button class="btn btn-secondary" id="deposit-cancel">Cancel</button>
            <button class="btn btn-primary" id="deposit-save" style="font-weight:700;">➕ Record Deposit Add</button>
          </div>
        </div>
      </div>
    `;

    const btnAdd = document.getElementById('btn-mode-add');
    const btnReduce = document.getElementById('btn-mode-reduce');
    const modeInput = document.getElementById('deposit-mode');
    const amountLbl = document.getElementById('deposit-amount-lbl');
    const limitHint = document.getElementById('deposit-limit-hint');
    const reasonGroup = document.getElementById('deposit-reason-group');
    const notesInput = document.getElementById('deposit-notes');
    const saveBtn = document.getElementById('deposit-save');

    btnAdd?.addEventListener('click', () => {
      modeInput.value = 'add';
      btnAdd.className = 'btn btn-primary';
      btnReduce.className = 'btn btn-secondary';
      amountLbl.textContent = 'Amount to Add (जमा राशि ₹) *';
      limitHint.style.display = 'none';
      reasonGroup.style.display = 'none';
      notesInput.placeholder = 'e.g. Advance booking for 22K gold bangle';
      saveBtn.className = 'btn btn-primary';
      saveBtn.textContent = '➕ Record Deposit Add';
    });

    btnReduce?.addEventListener('click', () => {
      modeInput.value = 'reduce';
      btnAdd.className = 'btn btn-secondary';
      btnReduce.className = 'btn btn-danger';
      amountLbl.textContent = 'Amount to Reduce / Refund (घटाने/वापसी की राशि ₹) *';
      limitHint.style.display = 'block';
      if (currentDeposit <= 0) {
        limitHint.textContent = 'ℹ️ Note: Recorded advance deposit is ₹0.00. Refund will be recorded as customer adjustment.';
      } else {
        limitHint.textContent = `Maximum reducible amount is ₹${Number(currentDeposit).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      }
      reasonGroup.style.display = 'block';
      notesInput.placeholder = 'e.g. Returned cash advance / refund to customer';
      saveBtn.className = 'btn btn-danger';
      saveBtn.textContent = '➖ Record Deposit Reduction';
    });

    document.getElementById('deposit-close')?.addEventListener('click', () => container.innerHTML = '');
    document.getElementById('deposit-cancel')?.addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'deposit-modal') container.innerHTML = ''; });
    document.getElementById('deposit-save')?.addEventListener('click', () => this._recordDeposit(currentDeposit));
  },

  async _recordDeposit(currentDeposit = 0) {
    const amount = parseFloat(document.getElementById('deposit-amount')?.value);
    const mode = document.getElementById('deposit-mode')?.value || 'add';

    if (!amount || amount <= 0) {
      document.getElementById('deposit-alert').innerHTML = '<div class="alert alert-error">Please enter a valid amount</div>';
      return;
    }

    if (mode === 'reduce' && currentDeposit > 0 && amount > currentDeposit) {
      document.getElementById('deposit-alert').innerHTML = `<div class="alert alert-error">Cannot reduce ₹${amount.toFixed(2)}. Available deposit is only ₹${currentDeposit.toFixed(2)}</div>`;
      return;
    }

    const btn = document.getElementById('deposit-save');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      const depositNotes = document.getElementById('deposit-notes')?.value?.trim() || undefined;
      const reason = document.getElementById('deposit-reason')?.value || 'refund';

      if (mode === 'reduce') {
        await API.invoke('khata:reduceDeposit', {
          customerId: this._selectedCustomer.id,
          amount,
          notes: depositNotes,
          reason
        });
        this._showToast(`Deposit reduced by ₹${amount.toFixed(2)} successfully`, 'success');
      } else {
        await API.invoke('khata:recordDeposit', {
          customerId: this._selectedCustomer.id,
          amount,
          notes: depositNotes
        });
        this._showToast(`Deposit of ₹${amount.toFixed(2)} added successfully`, 'success');
      }

      document.getElementById('khata-modal-container').innerHTML = '';
      await Promise.all([
        this._loadCustomerSummary(this._selectedCustomer.id),
        this._refreshTransactions()
      ]);

      const newBalance = this._customerSummary ? this._customerSummary.khata_balance : undefined;
      this._printDepositReceipt({
        amount,
        type: mode,
        notes: depositNotes,
        reason,
        customerName: this._selectedCustomer.name,
        newBalance
      });
      await this._reloadCustomersList();
      window.dispatchEvent(new CustomEvent('customer-changed'));
      this._renderMainView();
    } catch (err) {
      document.getElementById('deposit-alert').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = mode === 'reduce' ? '➖ Record Deposit Reduction' : '➕ Record Deposit Add';
    }
  },

  _showOpeningBalanceModal() {
    const c = this._selectedCustomer;
    if (!c) return;
    const container = document.getElementById('khata-modal-container');

    container.innerHTML = `
      <div class="modal-overlay" id="opening-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Opening Balance / Previous Dues</h2>
            <button class="modal-close" id="opening-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="opening-alert"></div>
            <p style="margin-bottom:16px">Record opening/previous dues for <strong>${this._escape(c.name)}</strong></p>
            <div style="margin-bottom:16px;font-size:13px;background:var(--bg-secondary);padding:12px;border-radius:6px;line-height:1.6">
              <strong>What is Opening Balance?</strong><br>
              Sets the starting khata balance when you first add a customer who already has existing dues from before using this system.
              <ul style="margin:6px 0 0 16px;padding:0">
                <li>Enter <strong>positive</strong> amount if customer owes you money (e.g. previous unpaid bills)</li>
                <li>Enter <strong>negative</strong> amount if you owe the customer (e.g. they had credit balance)</li>
                <li>You can add or update this anytime if previous dues change</li>
              </ul>
            </div>
            <form id="opening-form" onsubmit="return false">
              <div class="form-group">
                <label for="opening-amount">Amount *</label>
                <input type="number" id="opening-amount" class="form-control" step="0.01" placeholder="e.g. 50000 or -10000" autofocus>
              </div>
              <div class="form-group">
                <label for="opening-notes">Notes</label>
                <textarea id="opening-notes" class="form-control" rows="2" placeholder="e.g. Previous system balance as of 31 Dec 2025"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="opening-cancel">Cancel</button>
            <button class="btn btn-primary" id="opening-save">Record Opening Balance</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('opening-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('opening-cancel').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'opening-modal') container.innerHTML = ''; });

    document.getElementById('opening-save').addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('opening-amount').value);
      if (isNaN(amount) || amount === 0) {
        document.getElementById('opening-alert').innerHTML = '<div class="alert alert-error">Please enter a non-zero amount</div>';
        return;
      }
      const btn = document.getElementById('opening-save');
      btn.disabled = true;
      btn.textContent = 'Recording...';
      try {
        const notes = document.getElementById('opening-notes').value.trim() || undefined;
        await API.invoke('khata:recordOpeningBalance', { customerId: this._selectedCustomer.id, amount, notes });
        document.getElementById('khata-modal-container').innerHTML = '';
        this._showToast('Opening balance recorded', 'success');
        await Promise.all([
          this._loadCustomerSummary(this._selectedCustomer.id),
          this._refreshTransactions()
        ]);
        this._renderMainView();
        this._bindCustomerViewEvents();
      } catch (err) {
        document.getElementById('opening-alert').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Record Opening Balance';
      }
    });
  },

  _createBill() {
    APP_STATE.set('billCustomer', this._selectedCustomer);
    DASHBOARD_SCREEN.navigate('billing');
  },

  _exportLedger() {
    if (!this._transactions || !this._transactions.length) { Toast.show('No transactions to export', 'info'); return; }
    const header = 'Date,Type,Reference,Debit,Credit,Balance,Method,Notes';
    const rows = this._transactions.map(t => {
      const date = t.transaction_date || '';
      const type = this._transactionTypeLabel(t.transaction_type) || '';
      const ref = t.bill_id ? 'Bill #' + t.bill_id : (t.payment_id ? 'Payment #' + t.payment_id : '');
      return `"${date}","${type}","${ref}","${t.debit || 0}","${t.credit || 0}","${t.balance || 0}","${(t.payment_method || '')}","${(t.notes || '').replace(/"/g, '""')}"`;
    }).join('\n');
    this._downloadCSV([header, rows].join('\n'), 'khata_ledger_' + (this._selectedCustomer ? this._selectedCustomer.name.replace(/\s+/g, '_') : 'export') + '.csv');
    Toast.success('Ledger exported');
  },

  _downloadCSV(content, filename) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  },

  _toggleSort(col) {
    if (this._sortColumn === col) {
      this._sortDirection = this._sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this._sortColumn = col;
      this._sortDirection = 'ASC';
    }
    this._currentPage = 1;
    this._refreshTransactions();
  },

  _sortIcon(col) {
    if (this._sortColumn !== col) return '';
    return this._sortDirection === 'ASC' ? ' ▲' : ' ▼';
  },

  _goPage(page) {
    this._currentPage = page;
    this._refreshTransactions();
  },

  _showToast(msg, type) {
    if (typeof Toast !== 'undefined') Toast.show(msg, type);
  },

  async _showPrintKhataListModal() {
    let allCust = [];
    try {
      allCust = await API.invoke('khata:getAllWithBalance') || [];
    } catch (_) {
      allCust = this._customers || [];
    }

    const citiesSet = new Set();
    allCust.forEach(c => {
      const city = (c.city || c.address || '').trim();
      if (city) citiesSet.add(city);
    });
    const cities = Array.from(citiesSet).sort((a, b) => a.localeCompare(b));
    const isHi = window.I18N && window.I18N.getLang() === 'hi';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'khata-print-modal';
    modal.innerHTML = `
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <h2>🖨️ ${isHi ? 'खाता सूची प्रिंट करें' : 'Print Customer Khata List'}</h2>
          <button class="modal-close" onclick="document.getElementById('khata-print-modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;">${isHi ? 'स्थान / शहर चुनें (Select Place/City):' : 'Select Place / City:'}</label>
            <select class="form-control" id="kprint-city-select">
              <option value="">${isHi ? '🌍 सभी स्थान (All Places)' : '🌍 All Places (Whole List)'}</option>
              ${cities.map(ct => `<option value="${this._escape(ct)}">📍 ${this._escape(ct)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;">${isHi ? 'खाता प्रकार (Account Filter):' : 'Account Filter:'}</label>
            <select class="form-control" id="kprint-type-select">
              <option value="dues">${isHi ? '💰 केवल बाकी खाते (Only Customers with Dues > ₹0)' : '💰 Only Customers with Dues (> ₹0)'}</option>
              <option value="all">${isHi ? '📋 सभी ग्राहक खाते (All Customer Accounts)' : '📋 All Accounts (Including ₹0 Balance)'}</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;">${isHi ? 'क्रम (Sort Order):' : 'Sort Order:'}</label>
            <select class="form-control" id="kprint-sort-select">
              <option value="dues_desc">${isHi ? 'बाकी राशि: अधिक से कम (Dues: High to Low)' : 'Dues: High to Low'}</option>
              <option value="name_asc">${isHi ? 'नाम: A से Z (Customer Name A-Z)' : 'Customer Name (A-Z)'}</option>
              <option value="code_asc">${isHi ? 'ग्राहक ID (Customer ID Order)' : 'Customer ID Order'}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="document.getElementById('khata-print-modal').remove()">${isHi ? 'रद्द करें' : 'Cancel'}</button>
          <button class="btn btn-primary" id="kprint-confirm-btn" style="font-weight:700;">🖨️ ${isHi ? 'प्रिंट करें (Print Report)' : 'Print Report'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('kprint-confirm-btn')?.addEventListener('click', () => {
      const city = document.getElementById('kprint-city-select').value;
      const type = document.getElementById('kprint-type-select').value;
      const sort = document.getElementById('kprint-sort-select').value;
      document.getElementById('khata-print-modal')?.remove();
      this._printKhataListReport(allCust, { city, type, sort });
    });
  },

  async _printKhataListReport(allCust, { city, type, sort }) {
    let filtered = allCust.slice();

    if (city) {
      filtered = filtered.filter(c => ((c.city || c.address || '').trim().toLowerCase() === city.trim().toLowerCase()));
    }

    if (type === 'dues') {
      filtered = filtered.filter(c => (c.balance || 0) > 0);
    }

    if (sort === 'dues_desc') {
      filtered.sort((a, b) => (b.balance || 0) - (a.balance || 0));
    } else if (sort === 'name_asc') {
      filtered.sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''));
    } else if (sort === 'code_asc') {
      filtered.sort((a, b) => (a.cust_code || '').localeCompare(b.cust_code || ''));
    }

    const totalDues = filtered.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
    const shop = APP_STATE.get('shop') || {};
    const shopName = shop.shop_name || 'Jwellers Edith';
    const shopAddress = shop.address || '';
    const shopPhone = shop.phone || '';
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const areaLabel = city ? `📍 ${city}` : 'All Places (सभी स्थान)';

    const rowsHtml = filtered.map((c, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="font-weight:600;">${this._escape(c.cust_code || `CUST-${c.customer_id}`)}</td>
        <td>
          <strong>${this._escape(c.customer_name)}</strong>
          ${c.relation ? `<div style="font-size:11px;color:#666;">${this._escape(c.relation)}</div>` : ''}
        </td>
        <td>${this._escape(c.phone1 || '-')}</td>
        <td>${this._escape(c.city || c.address || '-')}</td>
        <td style="text-align:right;font-weight:700;color:${(c.balance || 0) > 0 ? '#c0392b' : '#27ae60'};">
          ₹${(c.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Khata Dues List - ${this._escape(city || 'All Places')}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #b8860b; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { margin: 0 0 4px; font-size: 24px; color: #b8860b; }
          .header p { margin: 2px 0; color: #555; font-size: 12px; }
          .report-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f8f9fa; border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #444; }
          td { border: 1px solid #ddd; padding: 7px 10px; font-size: 12px; }
          tr:nth-child(even) { background-color: #fafafa; }
          .footer-summary { margin-top: 16px; display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; background: #fdfaf2; border: 1px solid #b8860b; padding: 10px 16px; border-radius: 4px; }
          .no-print { text-align: center; margin-bottom: 20px; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()" style="padding:10px 24px;font-size:14px;background:#b8860b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">🖨️ Print This List (प्रिंट करें)</button>
          <button onclick="window.close()" style="padding:10px 18px;font-size:14px;margin-left:8px;background:#ddd;border:none;border-radius:4px;cursor:pointer;">Close</button>
        </div>
        <div class="header">
          <h1>${this._escape(shopName)}</h1>
          ${shopAddress ? `<p>${this._escape(shopAddress)}</p>` : ''}
          ${shopPhone ? `<p>Phone: ${this._escape(shopPhone)}</p>` : ''}
        </div>
        <div class="report-meta">
          <div>Report: <strong>Customer Khata Dues (${areaLabel})</strong></div>
          <div>Date: <strong>${dateStr}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;text-align:center;">#</th>
              <th style="width:100px;">Cust ID</th>
              <th>Customer Name</th>
              <th style="width:110px;">Phone</th>
              <th style="width:120px;">City / Place</th>
              <th style="width:130px;text-align:right;">Balance Dues (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:20px;">No customers found matching this criteria</td></tr>'}
          </tbody>
        </table>
        <div class="footer-summary">
          <div>Total Accounts: ${filtered.length}</div>
          <div>Total Dues (कुल बाकी): ₹${totalDues.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 350);
    }
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div'); div.textContent = str; return div.innerHTML;
  }
};

window.KHATA_SCREEN = KHATA_SCREEN;