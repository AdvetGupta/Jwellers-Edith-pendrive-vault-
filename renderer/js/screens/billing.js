const BILLING_SCREEN = {
  _customer: null,
  _items: [],
  _billType: 'gst',
  _billDate: new Date().toISOString().split('T')[0],
  _invoiceNumber: '',
  _paidAmount: 0,
  _paymentMethod: 'cash',
  _paymentReference: '',
  _notes: '',
  _gstRate: 3.0,
  _discountPercent: 0,
  _discountAmount: 0,
  _roundOff: 0,
  _isFinalizing: false,
  _isPrinting: false,

  async render() {
    const settings = await API.invoke('settings:getInvoiceConfig').catch(() => ({}));
    const prefix = settings.prefix || 'INV-';
    const year = new Date().getFullYear().toString();
    this._gstRate = settings.defaultGstRate || 3.0;
    return `
      <div class="billing-page">
        <div class="page-header">
          <h2>New Bill</h2>
          <div class="page-header-actions">
            <button class="btn btn-secondary" id="bill-preview-btn" style="display:none">Preview</button>
            <button class="btn btn-primary" id="bill-finalize-btn" disabled>Finalize Bill</button>
          </div>
        </div>
        <div id="bill-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div id="bill-modal-container"></div>
      </div>
    `;
  },

  async init(params) {
    this._items = [this._createEmptyItem()];
    this._invoiceNumber = await API.invoke('invoice:generate').catch(() => 'INV-2026-0001');

    const preSelected = APP_STATE.get('billCustomer');
    if (preSelected) {
      this._customer = preSelected;
      APP_STATE.set('billCustomer', null);
    } else if (params && params.customerId) {
      try {
        const cust = await API.invoke('customer:getById', { id: params.customerId });
        if (cust) {
          this._customer = { id: cust.id, name: cust.name, phone1: cust.phone1, city: cust.city };
        }
      } catch (e) { /* ignore */ }
    }

    if (this._customer && this._customer.id) {
      const bal = await API.invoke('khata:getCurrentBalance', { customerId: this._customer.id }).catch(() => 0);
      this._customer.khata_balance = bal || 0;
    }

    await this._renderContent();
    this._bindEvents();
  },

  _createEmptyItem() {
    return {
      item_type: 'manual',
      product_id: null,
      product_name: '',
      description: '',
      category_id: null,
      hsn_code: '',
      metal: '',
      purity: '',
      gross_weight: '',
      net_weight: '',
      making_charge: 0,
      today_rate: 0,
      price: 0,
      quantity: 1,
      discount_percentage: 0,
      total: 0
    };
  },

  async _renderContent() {
    const container = document.getElementById('bill-content');
    if (!container) return;

    const customerHtml = this._customer ? `
      <div class="bill-customer-selected">
        <div class="bill-customer-info">
          <strong>${this._escape(this._customer.name)}</strong>
          <span class="text-muted">${this._escape(this._customer.phone1 || '')}${this._customer.city ? ' | ' + this._escape(this._customer.city) : ''}</span>
          ${this._customer.khata_balance > 0 ? `<span class="bill-customer-due">Due: ₹${this._customer.khata_balance.toFixed(2)}</span>` : ''}
        </div>
        <button class="btn btn-sm btn-secondary" id="bill-change-customer">Change</button>
      </div>
    ` : `
      <div class="bill-customer-select">
        <div class="bill-customer-search-row">
          <input type="text" class="form-control" id="bill-customer-search" placeholder="Search customer by name, phone or ID..." autocomplete="off">
          <button class="btn btn-primary" id="bill-customer-search-btn">Search</button>
        </div>
        <div id="bill-customer-results"></div>
      </div>
    `;

    const halfGst = (this._gstRate / 2).toFixed(2);

    container.innerHTML = `
      <div class="bill-form">
        <div class="bill-section bill-customer-section">
          <h3>Customer</h3>
          ${customerHtml}
        </div>

        <div class="bill-section bill-info-section">
          <div class="bill-info-row">
            <div class="bill-info-field">
              <label>Bill Type</label>
              <div class="bill-type-toggle">
                <button class="btn btn-sm ${this._billType === 'gst' ? 'btn-primary' : 'btn-secondary'}" data-type="gst">GST</button>
                <button class="btn btn-sm ${this._billType === 'non_gst' ? 'btn-primary' : 'btn-secondary'}" data-type="non_gst">Non-GST</button>
              </div>
            </div>
            <div class="bill-info-field">
              <label>Date</label>
              <input type="date" class="form-control" id="bill-date" value="${this._billDate}">
            </div>
            <div class="bill-info-field">
              <label>Invoice No.</label>
              <input type="text" class="form-control" id="bill-invoice-no" placeholder="Auto / Manual Inv #" value="${this._escape(this._invoiceNumber)}">
            </div>
          </div>
        </div>

        <div class="bill-section bill-items-section">
          <div class="bill-section-header">
            <h3>Items</h3>
            <button class="btn btn-sm btn-primary" id="bill-add-item">+ Add Item</button>
          </div>
          <div class="bill-table-wrap">
            <table class="bill-items-table" id="bill-items-table">
              <thead>
                <tr>
                  <th style="width:80px">Type</th>
                  <th style="width:160px">Product / Description</th>
                  <th style="width:60px">HSN</th>
                  <th style="width:70px">Metal</th>
                  <th style="width:60px">Purity</th>
                  <th style="width:65px">Gross Wt</th>
                  <th style="width:65px">Net Wt</th>
                  <th style="width:70px">Mkg Chg</th>
                  <th style="width:65px">Today Rate</th>
                  <th style="width:70px">Price</th>
                  <th style="width:50px">Qty</th>
                  <th style="width:70px">Disc (₹)</th>
                  <th style="width:85px">Total</th>
                  <th style="width:30px"></th>
                </tr>
              </thead>
              <tbody id="bill-items-body"></tbody>
            </table>
            <datalist id="product-list"></datalist>
          </div>
        </div>

        <div class="bill-section bill-summary-section">
          <div class="bill-summary-grid">
            <div class="bill-summary-row">
              <span>Subtotal</span>
              <span id="bill-sum-subtotal">₹0.00</span>
            </div>
            <div class="bill-summary-row">
              <span>Making Charges</span>
              <span id="bill-sum-making">₹0.00</span>
            </div>
            <div class="bill-summary-row ${this._billType !== 'gst' ? 'hidden' : ''}" id="bill-sum-wastage-row">
              <span>Wastage</span>
              <span id="bill-sum-wastage">₹0.00</span>
            </div>
            <div class="bill-summary-row">
              <span>Discount</span>
              <span id="bill-sum-discount">₹0.00</span>
            </div>
            <div class="bill-summary-row ${this._billType !== 'gst' ? 'hidden' : ''}" id="bill-sum-taxable-row">
              <span>Taxable Amount</span>
              <span id="bill-sum-taxable">₹0.00</span>
            </div>
            <div class="bill-summary-row ${this._billType !== 'gst' ? 'hidden' : ''}" id="bill-sum-cgst-row">
              <span>CGST (${halfGst}%)</span>
              <span id="bill-sum-cgst">₹0.00</span>
            </div>
            <div class="bill-summary-row ${this._billType !== 'gst' ? 'hidden' : ''}" id="bill-sum-sgst-row">
              <span>SGST (${halfGst}%)</span>
              <span id="bill-sum-sgst">₹0.00</span>
            </div>
            <div class="bill-summary-row">
              <span>Round Off</span>
              <input type="number" class="form-control bill-round-off" id="bill-round-off" value="0" step="0.01">
            </div>
            <div class="bill-summary-row bill-summary-total">
              <span>Grand Total</span>
              <span id="bill-sum-grand">₹0.00</span>
            </div>
          </div>
        </div>

        <div class="bill-section bill-payment-section">
          <h3>Payment</h3>
          <div class="bill-payment-row">
            <div class="bill-payment-field">
              <label>Amount Received</label>
              <input type="number" class="form-control" id="bill-paid-amount" value="0" min="0" step="0.01">
            </div>
            <div class="bill-payment-field">
              <label>Payment Method</label>
              <select class="form-control" id="bill-payment-method">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="bill-payment-field">
              <label>Reference (UPI/Card)</label>
              <input type="text" class="form-control" id="bill-payment-ref" placeholder="Optional">
            </div>
          </div>
          <div class="bill-payment-status" id="bill-payment-status">Status: <strong>Unpaid</strong></div>
        </div>

        <div class="bill-section bill-notes-section">
          <label>Notes</label>
          <textarea class="form-control" id="bill-notes" rows="2" placeholder="Optional notes..."></textarea>
        </div>
      </div>
    `;

    this._renderItems();
    this._populateProductDatalist();
    this._recalc();
  },

  _renderItems() {
    const tbody = document.getElementById('bill-items-body');
    if (!tbody) return;
    tbody.innerHTML = this._items.map((item, idx) => this._renderItemRow(item, idx)).join('');
    this._bindItemEvents();
  },

  _renderItemRow(item, idx) {
    const isInventory = item.item_type === 'inventory';
    const productVal = isInventory && item.product_name ? item.product_name : item.description;
    return `
      <tr class="bill-item-row" data-index="${idx}">
        <td>
          <select class="form-control item-type-select" data-idx="${idx}">
            <option value="inventory" ${isInventory ? 'selected' : ''}>Inventory</option>
            <option value="manual" ${!isInventory ? 'selected' : ''}>Manual</option>
          </select>
        </td>
        <td>
          <input type="text" class="form-control item-desc" data-idx="${idx}" value="${this._escape(productVal)}" placeholder="${isInventory ? 'Search / select product...' : 'Enter description...'}" list="product-list">
          <div class="item-product-results" id="item-prod-results-${idx}"></div>
        </td>
        <td><input type="text" class="form-control item-hsn" data-idx="${idx}" value="${this._escape(item.hsn_code)}" placeholder="HSN"></td>
        <td><input type="text" class="form-control item-metal" data-idx="${idx}" value="${this._escape(item.metal)}" placeholder="Metal" list="metal-list-${idx}">
          <datalist id="metal-list-${idx}">
            <option value="Gold">
            <option value="Silver">
            <option value="Platinum">
            <option value="Palladium">
            <option value="Rose Gold">
            <option value="White Gold">
            <option value="Yellow Gold">
            <option value="KDM Gold">
            <option value="Hallmark Gold">
            <option value="Diamond">
            <option value="Copper">
            <option value="Brass">
            <option value="Stainless Steel">
          </datalist>
        </td>
        <td><input type="text" class="form-control item-purity" data-idx="${idx}" value="${this._escape(item.purity)}" placeholder="Purity"></td>
        <td><input type="number" class="form-control item-gross-wt" data-idx="${idx}" value="${item.gross_weight}" step="0.001" min="0" placeholder="0"></td>
        <td><input type="number" class="form-control item-net-wt" data-idx="${idx}" value="${item.net_weight}" step="0.001" min="0" placeholder="0"></td>
        <td><input type="number" class="form-control item-making" data-idx="${idx}" value="${item.making_charge}" step="0.01" min="0" placeholder="0"></td>
        <td><input type="number" class="form-control item-today-rate" data-idx="${idx}" value="${item.today_rate}" step="0.01" min="0" placeholder="0"></td>
        <td><input type="number" class="form-control item-price" data-idx="${idx}" value="${item.price}" step="0.01" min="0" placeholder="Auto" readonly style="background:var(--bg-secondary);cursor:default"></td>
        <td><input type="number" class="form-control item-qty" data-idx="${idx}" value="${item.quantity}" step="1" min="1" placeholder="1"></td>
        <td><input type="number" class="form-control item-disc" data-idx="${idx}" value="${item.discount_amount || 0}" step="1" min="0" placeholder="0"></td>
        <td><span class="item-total" id="item-total-${idx}">₹${(item.total || 0).toFixed(2)}</span></td>
        <td>
          ${this._items.length > 1 ? `<button class="btn btn-sm btn-danger item-remove" data-idx="${idx}">×</button>` : ''}
        </td>
      </tr>
    `;
  },

  _bindItemEvents() {
    document.querySelectorAll('.item-type-select').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const val = e.target.value;
        this._items[idx].item_type = val;
        this._items[idx].product_id = null;
        this._items[idx].product_name = '';
        if (val === 'manual') {
          this._items[idx].description = '';
          this._items[idx].hsn_code = '';
          this._items[idx].metal = '';
          this._items[idx].purity = '';
          this._items[idx].gross_weight = '';
          this._items[idx].net_weight = '';
          this._items[idx].today_rate = 0;
          this._items[idx].price = 0;
        }
        this._renderItems();
        this._recalc();
      });
    });

    document.querySelectorAll('.item-desc').forEach(el => {
      let timeout;
      el.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const item = this._items[idx];
        item.description = e.target.value;
        if (item.item_type === 'inventory') {
          clearTimeout(timeout);
          timeout = setTimeout(() => this._searchProduct(e.target), 300);
        }
      });
      el.addEventListener('blur', (e) => {
        setTimeout(() => {
          const results = document.getElementById(`item-prod-results-${e.target.dataset.idx}`);
          if (results) results.innerHTML = '';
        }, 200);
      });
    });

    document.querySelectorAll('.item-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        this._items.splice(idx, 1);
        this._renderItems();
        this._recalc();
      });
    });

    const recalcFields = ['.item-desc', '.item-hsn', '.item-metal', '.item-purity', '.item-gross-wt',
      '.item-net-wt', '.item-making', '.item-today-rate', '.item-qty', '.item-disc'];
    recalcFields.forEach(cls => {
      document.querySelectorAll(cls).forEach(el => {
        el.addEventListener('input', () => this._recalc());
        el.addEventListener('change', () => this._recalc());
      });
    });
  },

  async _populateProductDatalist() {
    const datalist = document.getElementById('product-list');
    if (!datalist || datalist.hasChildNodes()) return;
    try {
      const result = await API.invoke('product:search', { search: '', pageSize: 500, is_active: true, in_stock: true });
      const products = result.data || [];
      datalist.innerHTML = products.map(p => `<option value="${this._escape(p.product_name)}">`).join('');
    } catch (_) {}
  },

  async _searchProduct(inputEl) {
    const idx = parseInt(inputEl.dataset.idx);
    const term = inputEl.value.trim();
    const resultsDiv = document.getElementById(`item-prod-results-${idx}`);
    if (!resultsDiv) return;
    if (term.length < 1) { resultsDiv.innerHTML = ''; return; }
    try {
      const result = await API.invoke('product:search', { search: term, pageSize: 8, is_active: true, in_stock: true });
      const products = result.data || [];
      if (products.length === 0) { resultsDiv.innerHTML = '<div class="item-prod-no-results">No products found</div>'; return; }
      resultsDiv.innerHTML = products.map(p => `
        <div class="item-prod-result" data-idx="${idx}" data-pid="${p.id}"
             data-name="${this._escape(p.product_name)}"
             data-cat="${p.category_id || ''}" data-hsn="${this._escape(p.hsn_code || '')}"
             data-metal="${this._escape(p.metal || '')}" data-purity="${this._escape(p.purity || '')}"
             data-gross="${p.gross_weight || ''}" data-net="${p.net_weight || ''}"
             data-making="${p.making_charge || 0}" data-rate="${p.selling_price || 0}"
             data-stock="${p.quantity_in_stock || 0}">
          <strong>${this._escape(p.product_name)}</strong>
          <span class="text-muted">${p.metal ? this._escape(p.metal) : ''}${p.purity ? ' ' + this._escape(p.purity) : ''} | Stock: ${p.quantity_in_stock || 0} | ₹${(p.selling_price || 0).toFixed(2)}</span>
        </div>
      `).join('');
      resultsDiv.querySelectorAll('.item-prod-result').forEach(el => {
        el.addEventListener('click', () => {
          const item = this._items[idx];
          item.product_id = parseInt(el.dataset.pid);
          item.product_name = el.dataset.name;
          item.description = el.dataset.name;
          item.category_id = el.dataset.cat || null;
          item.hsn_code = el.dataset.hsn;
          item.metal = el.dataset.metal;
          item.purity = el.dataset.purity;
          item.gross_weight = el.dataset.gross;
          item.net_weight = el.dataset.net;
          item.making_charge = parseFloat(el.dataset.making) || 0;
          item.today_rate = parseFloat(el.dataset.rate) || 0;
          item.quantity = 1;
          resultsDiv.innerHTML = '';
          this._renderItems();
          this._recalc();
        });
      });
    } catch (err) {
      resultsDiv.innerHTML = `<div class="item-prod-no-results">Error: ${this._escape(err.message)}</div>`;
    }
  },

  _recalc() {
    const rows = document.querySelectorAll('.bill-item-row');
    let subtotal = 0, makingTotal = 0, discountTotal = 0, taxableTotal = 0;
    let cgstTotal = 0, sgstTotal = 0;

    rows.forEach(row => {
      const idx = parseInt(row.dataset.index);
      const item = this._items[idx];
      const qty = parseFloat(row.querySelector('.item-qty')?.value) || 1;
      const making = parseFloat(row.querySelector('.item-making')?.value) || 0;
      const todayRate = parseFloat(row.querySelector('.item-today-rate')?.value) || 0;
      const itemDiscount = parseFloat(row.querySelector('.item-disc')?.value) || 0;
      const netWt = parseFloat(row.querySelector('.item-net-wt')?.value) || 0;
      const price = netWt * todayRate;

      item.today_rate = todayRate;
      item.price = price;
      item.quantity = qty;
      item.making_charge = making;
      item.discount_amount = itemDiscount;
      item.discount_percentage = (price * qty) > 0 ? (itemDiscount / (price * qty) * 100) : 0;
      item.gross_weight = row.querySelector('.item-gross-wt')?.value || item.gross_weight;
      item.net_weight = netWt;

      const priceInput = row.querySelector('.item-price');
      if (priceInput) priceInput.value = price.toFixed(2);

      if (row.querySelector('.item-desc')) {
        item.description = row.querySelector('.item-desc').value;
      }
      if (row.querySelector('.item-hsn')) {
        item.hsn_code = row.querySelector('.item-hsn').value;
      }
      if (row.querySelector('.item-metal')) {
        item.metal = row.querySelector('.item-metal').value;
      }
      if (row.querySelector('.item-purity')) {
        item.purity = row.querySelector('.item-purity').value;
      }

      const lineTotal = price * qty;
      const itemTaxable = this._billType === 'gst' ? (lineTotal + making - itemDiscount) : 0;

      item.discount_amount = itemDiscount;
      item.taxable_amount = itemTaxable;

      const halfGst = this._gstRate / 2;
      const itemCgst = this._billType === 'gst' ? (itemTaxable * halfGst / 100) : 0;
      const itemSgst = this._billType === 'gst' ? (itemTaxable * halfGst / 100) : 0;
      const itemTotal = this._billType === 'gst' ? (itemTaxable + itemCgst + itemSgst) : (lineTotal + making - itemDiscount);

      item.cgst_rate = halfGst;
      item.sgst_rate = halfGst;
      item.cgst_amount = itemCgst;
      item.sgst_amount = itemSgst;
      item.total = itemTotal;

      const totalEl = document.getElementById(`item-total-${idx}`);
      if (totalEl) totalEl.textContent = `₹${itemTotal.toFixed(2)}`;

      subtotal += lineTotal;
      makingTotal += making;
      discountTotal += itemDiscount;
      taxableTotal += itemTaxable;
      cgstTotal += itemCgst;
      sgstTotal += itemSgst;
    });

    this._discountAmount = discountTotal;
    this._discountPercent = subtotal > 0 ? (discountTotal / subtotal * 100) : 0;
    const roundOff = parseFloat(document.getElementById('bill-round-off')?.value) || 0;
    this._roundOff = roundOff;
    const grandTotal = this._billType === 'gst'
      ? Math.round((taxableTotal + cgstTotal + sgstTotal + roundOff) * 100) / 100
      : Math.round((subtotal + makingTotal - discountTotal + roundOff) * 100) / 100;

    document.getElementById('bill-sum-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('bill-sum-making').textContent = `₹${makingTotal.toFixed(2)}`;
    document.getElementById('bill-sum-wastage').textContent = `₹0.00`;
    document.getElementById('bill-sum-discount').textContent = `₹${discountTotal.toFixed(2)}`;
    document.getElementById('bill-sum-taxable').textContent = `₹${taxableTotal.toFixed(2)}`;
    document.getElementById('bill-sum-cgst').textContent = `₹${cgstTotal.toFixed(2)}`;
    document.getElementById('bill-sum-sgst').textContent = `₹${sgstTotal.toFixed(2)}`;
    document.getElementById('bill-sum-grand').textContent = `₹${grandTotal.toFixed(2)}`;

    const paidAmount = parseFloat(document.getElementById('bill-paid-amount')?.value) || 0;
    this._updatePaymentStatus(paidAmount, grandTotal);
    this._updateFinalizeBtn(grandTotal);
  },

  _updatePaymentStatus(paid, grand) {
    const el = document.getElementById('bill-payment-status');
    if (!el) return;
    if (paid <= 0) el.innerHTML = 'Status: <strong>Unpaid</strong>';
    else if (paid >= grand) el.innerHTML = 'Status: <strong class="text-success">Paid</strong>';
    else el.innerHTML = `Status: <strong class="text-warning">Partial</strong> (Due: ₹${(grand - paid).toFixed(2)})`;
  },

  _updateFinalizeBtn(grandTotal) {
    const btn = document.getElementById('bill-finalize-btn');
    const previewBtn = document.getElementById('bill-preview-btn');
    if (!btn) return;
    if (this._customer && this._items.length > 0) {
      btn.disabled = false;
      btn.textContent = `Finalize Bill — ₹${grandTotal.toFixed(2)}`;
      if (previewBtn) previewBtn.style.display = 'inline-block';
    } else {
      btn.disabled = true;
      btn.textContent = 'Finalize Bill';
      if (previewBtn) previewBtn.style.display = 'none';
    }
  },

  _bindEvents() {
    document.getElementById('bill-customer-search-btn')?.addEventListener('click', () => this._searchCustomers());
    document.getElementById('bill-customer-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._searchCustomers();
    });
    document.getElementById('bill-change-customer')?.addEventListener('click', () => {
      this._customer = null;
      this._renderContent();
      this._bindEvents();
    });
    document.querySelectorAll('.bill-type-toggle button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._billType = e.target.dataset.type;
        this._renderContent();
        this._bindEvents();
      });
    });
    document.getElementById('bill-date')?.addEventListener('change', (e) => {
      this._billDate = e.target.value;
    });
    document.getElementById('bill-add-item')?.addEventListener('click', () => {
      this._items.push(this._createEmptyItem());
      this._renderItems();
      this._recalc();
    });
    document.getElementById('bill-paid-amount')?.addEventListener('input', () => this._recalc());
    document.getElementById('bill-payment-method')?.addEventListener('change', (e) => {
      this._paymentMethod = e.target.value;
    });
    document.getElementById('bill-payment-ref')?.addEventListener('input', (e) => {
      this._paymentReference = e.target.value;
    });
    document.getElementById('bill-notes')?.addEventListener('input', (e) => {
      this._notes = e.target.value;
    });
    document.getElementById('bill-round-off')?.addEventListener('input', () => this._recalc());
    
    const finalizeBtn = document.getElementById('bill-finalize-btn');
    if (finalizeBtn) {
      const newBtn = finalizeBtn.cloneNode(true);
      finalizeBtn.parentNode.replaceChild(newBtn, finalizeBtn);
      newBtn.addEventListener('click', () => this._finalize());
    }
    
    const previewBtn = document.getElementById('bill-preview-btn');
    if (previewBtn) {
      const newBtn = previewBtn.cloneNode(true);
      previewBtn.parentNode.replaceChild(newBtn, previewBtn);
      newBtn.addEventListener('click', () => this._preview());
    }
  },

  async _searchCustomers() {
    const input = document.getElementById('bill-customer-search');
    const resultsDiv = document.getElementById('bill-customer-results');
    const term = input.value.trim();
    if (!term) return;
    try {
      const result = await API.invoke('customer:search', { search: term, pageSize: 10 });
      const customers = result.data || [];
      let html = '';
      if (customers.length === 0) {
        html += '<div class="alert alert-info">No customers found</div>';
      } else {
        html += customers.map(c => `
          <div class="customer-result-item" data-cid="${c.id}" data-name="${this._escape(c.name)}"
               data-phone="${this._escape(c.phone1 || '')}" data-city="${this._escape(c.city || '')}">
            <strong>${this._escape(c.name)}</strong>
            <span class="text-muted">${this._escape(c.phone1 || '')}${c.city ? ' | ' + this._escape(c.city) : ''}</span>
          </div>
        `).join('');
      }
      html += `<div class="customer-result-new" data-term="${this._escape(term)}">
        <button class="btn btn-sm btn-primary" id="bill-create-customer-btn">+ Create "${this._escape(term)}"</button>
      </div>`;
      resultsDiv.innerHTML = html;
      resultsDiv.querySelectorAll('.customer-result-item').forEach(el => {
        el.addEventListener('click', async () => {
          this._customer = { id: parseInt(el.dataset.cid), name: el.dataset.name, phone1: el.dataset.phone, city: el.dataset.city };
          const bal = await API.invoke('khata:getCurrentBalance', { customerId: this._customer.id }).catch(() => 0);
          this._customer.khata_balance = bal || 0;
          this._renderContent();
          this._bindEvents();
        });
      });
      document.getElementById('bill-create-customer-btn')?.addEventListener('click', () => this._showCreateCustomerModal(term));
    } catch (err) {
      document.getElementById('bill-customer-results').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
    }
  },

  async _showCreateCustomerModal(term) {
    const container = document.getElementById('bill-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="create-customer-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Create New Customer</h2>
            <button class="modal-close" id="create-customer-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="create-customer-alert"></div>
            <form id="create-customer-form" onsubmit="return false">
              <div class="form-group">
                <label for="cc-name">Name *</label>
                <input type="text" id="cc-name" class="form-control" value="${this._escape(term)}" placeholder="Customer name" autofocus>
              </div>
              <div class="form-group">
                <label for="cc-relation">Relation (पिता / पति / रिश्तेदार)</label>
                <input type="text" id="cc-relation" class="form-control" placeholder="e.g. S/o Ramesh Patel / W/o Suresh">
              </div>
              <div class="form-group">
                <label for="cc-phone1">Phone</label>
                <input type="text" id="cc-phone1" class="form-control" placeholder="Phone number (optional)">
              </div>
              <div class="form-group">
                <label for="cc-city">City</label>
                <input type="text" id="cc-city" class="form-control" placeholder="City">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="create-customer-cancel">Cancel</button>
            <button class="btn btn-primary" id="create-customer-save">Create & Select</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('create-customer-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('create-customer-cancel').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'create-customer-modal') container.innerHTML = ''; });
    document.getElementById('create-customer-save').addEventListener('click', async () => {
      const name = document.getElementById('cc-name').value.trim();
      if (!name) {
        document.getElementById('create-customer-alert').innerHTML = '<div class="alert alert-error">Name is required</div>';
        return;
      }
      const btn = document.getElementById('create-customer-save');
      btn.disabled = true;
      btn.textContent = 'Creating...';
      try {
        const customer = await API.invoke('customer:create', {
          name,
          relation: document.getElementById('cc-relation')?.value.trim() || undefined,
          phone1: document.getElementById('cc-phone1').value.trim() || undefined,
          city: document.getElementById('cc-city').value.trim() || undefined
        });
        container.innerHTML = '';
        window.dispatchEvent(new CustomEvent('customer-changed'));
        this._customer = { id: customer.id, name: customer.name, phone1: customer.phone1 || '', city: customer.city || '' };
        const bal = await API.invoke('khata:getCurrentBalance', { customerId: this._customer.id }).catch(() => 0);
        this._customer.khata_balance = bal || 0;
        this._renderContent();
        this._bindEvents();
      } catch (err) {
        document.getElementById('create-customer-alert').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create & Select';
      }
    });
  },

  async _finalize() {
    if (this._isFinalizing) return;
    this._isFinalizing = true;
    const btn = document.getElementById('bill-finalize-btn');
    btn.disabled = true;
    btn.textContent = 'Finalizing...';

    const paidAmount = parseFloat(document.getElementById('bill-paid-amount')?.value) || 0;

    const items = this._items.map((item, idx) => {
      const qty = parseFloat(item.quantity) || 1;
      const making = parseFloat(item.making_charge) || 0;
      const todayRate = parseFloat(item.today_rate) || 0;
      const netWt = parseFloat(item.net_weight) || 0;
      const price = netWt * todayRate;
      const discPct = parseFloat(item.discount_percentage) || 0;
      const lineTotal = price * qty;
      const discAmt = lineTotal * discPct / 100;
      const taxableAmt = this._billType === 'gst' ? (lineTotal + making - discAmt) : 0;
      const halfGst = this._gstRate / 2;
      const cgstAmt = this._billType === 'gst' ? (taxableAmt * halfGst / 100) : 0;
      const sgstAmt = this._billType === 'gst' ? (taxableAmt * halfGst / 100) : 0;
      const total = this._billType === 'gst' ? (taxableAmt + cgstAmt + sgstAmt) : (lineTotal + making - discAmt);

      return {
        item_type: item.item_type,
        product_id: item.product_id,
        description: item.description || (item.item_type === 'inventory' ? `Product #${item.product_id}` : 'Item'),
        category_id: item.category_id,
        hsn_code: item.hsn_code,
        metal: item.metal,
        purity: item.purity,
        gross_weight: item.gross_weight || null,
        net_weight: netWt || null,
        making_charge: making,
        wastage_percentage: todayRate,
        wastage_amount: 0,
        rate: price,
        quantity: qty,
        discount_percentage: discPct,
        discount_amount: discAmt,
        taxable_amount: taxableAmt,
        cgst_rate: halfGst,
        sgst_rate: halfGst,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        today_rate: todayRate,
        total
      };
    });

    const subtotal = items.reduce((s, i) => s + (i.rate * i.quantity), 0);
    const makingTotal = items.reduce((s, i) => s + i.making_charge, 0);
    const discountTotal = items.reduce((s, i) => s + i.discount_amount, 0);
    const taxableTotal = items.reduce((s, i) => s + i.taxable_amount, 0);
    const cgstTotal = items.reduce((s, i) => s + i.cgst_amount, 0);
    const sgstTotal = items.reduce((s, i) => s + i.sgst_amount, 0);
    const taxTotal = cgstTotal + sgstTotal;
    const roundOff = parseFloat(document.getElementById('bill-round-off')?.value) || 0;
    const grandTotal = this._billType === 'gst'
      ? Math.round((taxableTotal + taxTotal + roundOff) * 100) / 100
      : Math.round((subtotal + makingTotal - discountTotal + roundOff) * 100) / 100;
    const khataBefore = this._customer ? (this._customer.khata_balance || 0) : 0;

    try {
      const manualInv = document.getElementById('bill-invoice-no')?.value.trim();
      const bill = await API.invoke('bill:create', {
        customer_id: this._customer.id,
        invoice_number: manualInv || this._invoiceNumber,
        bill_type: this._billType,
        bill_date: this._billDate,
        items,
        subtotal,
        discount_percentage: subtotal > 0 ? (discountTotal / subtotal * 100) : 0,
        discount_amount: discountTotal,
        making_charge_total: makingTotal,
        stone_charge_total: 0,
        wastage_total: 0,
        taxable_amount: taxableTotal,
        cgst_rate: this._billType === 'gst' ? this._gstRate / 2 : 0,
        sgst_rate: this._billType === 'gst' ? this._gstRate / 2 : 0,
        cgst_amount: cgstTotal,
        sgst_amount: sgstTotal,
        tax_total: taxTotal,
        round_off: roundOff,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        payment_method: paidAmount > 0 ? this._paymentMethod : null,
        payment_reference: this._paymentReference || null,
        khata_before: khataBefore,
        notes: this._notes || null
      });

      this._showSuccess(bill);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = `Finalize Bill — ₹${grandTotal.toFixed(2)}`;
      alert('Failed to create bill: ' + err.message);
    } finally {
      this._isFinalizing = false;
    }
  },

  _showSuccess(bill) {
    const container = document.getElementById('bill-content');
    if (!container) return;
    const hasPhone = this._customer && (this._customer.phone1 || this._customer.phone2);
    const shareDropdownItems = hasPhone ? `
      <button class="btn btn-outline" id="bill-share-btn">Share</button>
      <div class="dropdown-menu" id="bill-share-dropdown" style="display:none;position:absolute;top:100%;right:0;z-index:100;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:180px;">
        <button class="dropdown-item" data-type="whatsapp" data-msg="invoice">WhatsApp Invoice</button>
        <button class="dropdown-item" data-type="sms" data-msg="invoice">Send SMS Invoice</button>
      </div>
    ` : '';
    container.innerHTML = `
      <div class="bill-success">
        <div class="bill-success-icon">✓</div>
        <h2>Bill Created Successfully</h2>
        <p>Invoice: <strong>${this._escape(bill.invoice_number)}</strong></p>
        <p>Total: <strong>₹${(bill.grand_total || 0).toFixed(2)}</strong></p>
        <p>Status: <strong>${this._escape(bill.payment_status)}</strong></p>
        <div class="bill-success-actions" style="position:relative">
          <button class="btn btn-primary" id="bill-print-btn">Print Invoice</button>
          <button class="btn btn-secondary" id="bill-new-btn">New Bill</button>
          ${shareDropdownItems}
        </div>
      </div>
    `;
    document.getElementById('bill-print-btn')?.addEventListener('click', () => {
      const khataBeforeVal = bill.khata_before != null ? bill.khata_before : (this._customer ? this._customer.khata_balance || 0 : 0);
      const printData = {
        settings: bill.settings || {},
        khataBefore: khataBeforeVal,
        customer: this._customer,
        invoiceNumber: bill.invoice_number,
        billDate: bill.bill_date,
        billType: bill.bill_type,
        gstRate: bill.cgst_rate ? bill.cgst_rate * 2 : 3,
        items: (bill.items || []).map(it => ({
          item: it,
          todayRate: parseFloat(it.wastage_percentage) || 0,
          price: parseFloat(it.rate) || 0,
          netWt: parseFloat(it.net_weight) || 0,
          qty: parseFloat(it.quantity) || 1,
          making: parseFloat(it.making_charge) || 0,
          discAmt: parseFloat(it.discount_amount) || 0,
          taxableAmt: parseFloat(it.taxable_amount) || 0,
          cgstAmt: parseFloat(it.cgst_amount) || 0,
          sgstAmt: parseFloat(it.sgst_amount) || 0,
          lineTotal: parseFloat(it.total) || 0
        })),
        subtotal: bill.subtotal || 0,
        makingTotal: bill.making_charge_total || 0,
        discountTotal: bill.discount_amount || 0,
        taxableTotal: bill.taxable_amount || 0,
        cgstTotal: bill.cgst_amount || 0,
        sgstTotal: bill.sgst_amount || 0,
        roundOff: bill.round_off || 0,
        grandTotal: bill.grand_total || 0,
        paidAmount: bill.paid_amount || 0,
        paymentMethod: '',
        paymentStatus: bill.payment_status || 'Unpaid',
        balance: bill.balance_amount || 0
      };
      this._printPreview(printData);
    });
    document.getElementById('bill-new-btn')?.addEventListener('click', () => {
      this._customer = null;
      this._items = [this._createEmptyItem()];
      this._paidAmount = 0;
      this._renderContent();
      this._bindEvents();
    });

    if (hasPhone) {
      const shareBtn = document.getElementById('bill-share-btn');
      const dropdown = document.getElementById('bill-share-dropdown');
      shareBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', () => { if (dropdown) dropdown.style.display = 'none'; }, { once: false });
      dropdown?.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          dropdown.style.display = 'none';
          this._sendCommunication(this._customer, item.dataset.type, item.dataset.msg, bill.id);
        });
      });
    }

    document.getElementById('bill-finalize-btn').style.display = 'none';
    document.getElementById('bill-preview-btn').style.display = 'none';
  },

  async _sendCommunication(customer, commType, messageType, billId, paymentId) {
    try {
      const result = await API.invoke('communication:send', {
        customer_id: customer.id,
        communication_type: commType,
        message_type: messageType,
        bill_id: billId || null,
        payment_id: paymentId || null
      });
      if (result.success && result.whatsappUrl) {
        this._showWhatsAppPreviewModal(customer, result);
      } else if (result.success && result.smsTo) {
        Toast.info('SMS queued for ' + result.smsTo);
      } else if (!result.success) {
        Toast.error('Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      Toast.error('Communication failed: ' + err.message);
    }
  },

  _showWhatsAppPreviewModal(customer, result) {
    const container = document.getElementById('bill-modal-container') || document.body;
    const phone = result.cleanedPhone || (customer.phone1 || customer.phone || '').trim();
    const custName = customer.name || 'Customer';

    const modalHtml = `
      <div class="modal-overlay" id="bill-wa-preview-modal">
        <div class="modal" style="max-width:560px;width:95%;">
          <div class="modal-header">
            <h2 style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:22px;">💬</span>
              <span>Send Invoice WhatsApp</span>
            </h2>
            <button class="modal-close" id="bill-wa-close">&times;</button>
          </div>
          <div class="modal-body" style="padding:16px 20px;">
            <div style="background:var(--bg-app);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-weight:700;font-size:15px;color:var(--text-primary);">👤 ${this._escape(custName)}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Phone: <strong style="color:var(--primary);">+${this._escape(phone)}</strong></div>
                </div>
                <div style="font-size:12px;background:#25D366;color:#fff;padding:4px 10px;border-radius:12px;font-weight:700;">WhatsApp Ready</div>
              </div>
            </div>

            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Message Text (Review & Edit):</label>
                <button class="btn btn-xs btn-outline" id="bill-wa-copy-btn" type="button" style="display:flex;align-items:center;gap:4px;">
                  📋 Copy Text
                </button>
              </div>
              <textarea id="bill-wa-textarea" class="form-control" style="width:100%;height:180px;font-size:13px;line-height:1.45;font-family:inherit;padding:10px;resize:vertical;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);">${this._escape(result.message || '')}</textarea>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin:0;">
              💡 <strong>Tip:</strong> Choose <strong>Open in WhatsApp</strong> (desktop app or browser) or <strong>WhatsApp Web</strong>, or click <strong>Copy Text</strong> to paste directly into your chat.
            </p>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <button class="btn btn-secondary" id="bill-wa-cancel" type="button">Close</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-outline" id="bill-wa-web-btn" type="button" style="display:flex;align-items:center;gap:6px;">
                🌐 WhatsApp Web
              </button>
              <button class="btn btn-success" id="bill-wa-app-btn" type="button" style="background:#25D366;border-color:#25D366;color:#fff;font-weight:700;display:flex;align-items:center;gap:6px;">
                🚀 Open in WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    if (container === document.body) {
      container.insertAdjacentHTML('beforeend', modalHtml);
    } else {
      container.innerHTML = modalHtml;
    }

    const close = () => {
      const el = document.getElementById('bill-wa-preview-modal');
      if (el) el.remove();
      if (container !== document.body) container.innerHTML = '';
    };
    document.getElementById('bill-wa-close')?.addEventListener('click', close);
    document.getElementById('bill-wa-cancel')?.addEventListener('click', close);

    document.getElementById('bill-wa-copy-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('bill-wa-textarea')?.value || '';
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
        const copyBtn = document.getElementById('bill-wa-copy-btn');
        if (copyBtn) copyBtn.textContent = '✅ Copied!';
        setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copy Text'; }, 2000);
        Toast.success('Message copied to clipboard!');
      } catch (err) {
        Toast.error('Copy failed: ' + err.message);
      }
    });

    document.getElementById('bill-wa-web-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('bill-wa-textarea')?.value || '';
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      try {
        await API.invoke('utils:openExternal', { url });
        Toast.success(`Opened WhatsApp Web for +${phone}`);
      } catch (err) {
        try {
          window.open(url, '_blank');
          Toast.success(`Opened WhatsApp Web for +${phone}`);
        } catch (e2) {
          Toast.error('Failed to open WhatsApp Web: ' + err.message);
        }
      }
    });

    document.getElementById('bill-wa-app-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('bill-wa-textarea')?.value || '';
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      try {
        await API.invoke('utils:openExternal', { url });
        Toast.success(`Opened WhatsApp for +${phone}`);
      } catch (err) {
        try {
          window.open(url, '_blank');
          Toast.success(`Opened WhatsApp for +${phone}`);
        } catch (e2) {
          Toast.error('Failed to open WhatsApp: ' + err.message);
        }
      }
    });
  },

  async _preview() {
    const bill = await this._buildPreviewData();
    this._printPreview(bill);
  },

  async _buildPreviewData() {
    const settings = await API.invoke('settings:get').catch(() => ({}));
    let khataBefore = 0;
    if (this._customer && this._customer.id) {
      const bal = await API.invoke('khata:getCurrentBalance', { customerId: this._customer.id }).catch(() => 0);
      khataBefore = bal || 0;
    }
    const paidAmount = parseFloat(document.getElementById('bill-paid-amount')?.value) || 0;
    const items = this._items.map((item, idx) => {
      const qty = parseFloat(item.quantity) || 1;
      const making = parseFloat(item.making_charge) || 0;
      const todayRate = parseFloat(item.today_rate) || 0;
      const netWt = parseFloat(item.net_weight) || 0;
      const price = netWt * todayRate;
      const discPct = parseFloat(item.discount_percentage) || 0;
      const lineTotal = price * qty;
      const discAmt = lineTotal * discPct / 100;
      const taxableAmt = this._billType === 'gst' ? (lineTotal + making - discAmt) : 0;
      const halfGst = this._gstRate / 2;
      const cgstAmt = this._billType === 'gst' ? (taxableAmt * halfGst / 100) : 0;
      const sgstAmt = this._billType === 'gst' ? (taxableAmt * halfGst / 100) : 0;
      return { item, todayRate, price, netWt, qty, making, discAmt, taxableAmt, cgstAmt, sgstAmt, lineTotal };
    });

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const makingTotal = items.reduce((s, i) => s + i.making, 0);
    const discountTotal = items.reduce((s, i) => s + i.discAmt, 0);
    const taxableTotal = items.reduce((s, i) => s + i.taxableAmt, 0);
    const cgstTotal = items.reduce((s, i) => s + i.cgstAmt, 0);
    const sgstTotal = items.reduce((s, i) => s + i.sgstAmt, 0);
    const roundOff = parseFloat(document.getElementById('bill-round-off')?.value) || 0;
    const grandTotal = this._billType === 'gst'
      ? Math.round((taxableTotal + cgstTotal + sgstTotal + roundOff) * 100) / 100
      : Math.round((subtotal + makingTotal - discountTotal + roundOff) * 100) / 100;

    return {
      settings, khataBefore,
      customer: this._customer,
      invoiceNumber: this._invoiceNumber,
      billDate: this._billDate,
      billType: this._billType,
      gstRate: this._gstRate,
      items, subtotal, makingTotal, discountTotal,
      taxableTotal, cgstTotal, sgstTotal, roundOff, grandTotal,
      paidAmount, paymentMethod: this._paymentMethod,
      paymentStatus: paidAmount <= 0 ? 'Unpaid' : (paidAmount >= grandTotal ? 'Paid' : 'Partial'),
      balance: Math.max(0, grandTotal - paidAmount)
    };
  },

  _printPreview(data) {
    if (this._isPrinting) return;
    this._isPrinting = true;
    const w = window.open('', '_blank', 'width=900,height=700');
    const s = data.settings || {};
    const halfGst = data.billType === 'gst' ? (data.gstRate / 2).toFixed(2) : '0.00';
    const cust = data.customer || {};
    const khataBefore = data.khataBefore || 0;
    const oldDues = khataBefore > 0 ? `Old Dues: ₹${khataBefore.toFixed(2)}` : '';
    w.document.write(`
      <!DOCTYPE html><html><head>
      <title>Invoice - ${data.invoiceNumber}</title>
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
          <h1>${s.shop_name || 'Jwellers Edith'}</h1>
          <div class="sub">${s.address || ''}${s.city ? ', ' + s.city : ''}${s.phone ? ' | Ph: ' + s.phone : ''}</div>
          ${data.billType === 'gst' && s.gst_number ? `<div class="sub">GST: ${s.gst_number}</div>` : ''}
        </div>
        <div class="info-row">
          <div class="info-box">
            <h3>Bill To</h3>
            <p><strong>${this._escape(cust.name || 'Walk-in Customer')}</strong></p>
            <p>${this._escape(cust.phone1 || '')}</p>
            <p>${cust.city ? 'Place: ' + this._escape(cust.city) : ''}</p>
            ${data.billType === 'gst' && cust.gst_number ? `<p>GST: ${this._escape(cust.gst_number)}</p>` : ''}
          </div>
          <div class="info-box" style="text-align:right">
            <h3>Invoice</h3>
            <p><strong>${data.invoiceNumber}</strong></p>
            <p>Date: ${data.billDate}</p>
            <p>Type: ${data.billType.toUpperCase()}</p>
            ${oldDues ? `<p style="color:#c0392b">${oldDues}</p>` : ''}
          </div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Description</th>
            ${data.billType === 'gst' ? '<th>HSN</th>' : ''}
            <th>Metal/Purity</th><th>Wt</th><th>Today Rate</th><th>Price</th><th>Qty</th><th>Mkg</th>
            <th class="amt">Total</th>
          </tr></thead>
          <tbody>
            ${data.items.map((row, i) => `<tr>
              <td>${i + 1}</td>
              <td>${this._escape(row.item.description || row.item.product_name || 'Item')}</td>
              ${data.billType === 'gst' ? `<td>${row.item.hsn_code || '-'}</td>` : ''}
              <td>${row.item.metal || ''} ${row.item.purity || ''}</td>
              <td>${row.item.gross_weight || '-'}</td>
              <td class="amt">${row.todayRate ? '₹' + row.todayRate.toFixed(2) : '-'}</td>
              <td class="amt">₹${row.price.toFixed(2)}</td>
              <td class="amt">${row.qty}</td>
              <td class="amt">₹${row.making.toFixed(2)}</td>
              <td class="amt">₹${(row.lineTotal).toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>₹${data.subtotal.toFixed(2)}</span></div>
          <div class="totals-row"><span>Making Charges</span><span>₹${data.makingTotal.toFixed(2)}</span></div>
          <div class="totals-row"><span>Discount</span><span>₹${data.discountTotal.toFixed(2)}</span></div>
          ${data.billType === 'gst' ? `
          <div class="totals-row"><span>Taxable Amount</span><span>₹${data.taxableTotal.toFixed(2)}</span></div>
          <div class="totals-row"><span>CGST (${halfGst}%)</span><span>₹${data.cgstTotal.toFixed(2)}</span></div>
          <div class="totals-row"><span>SGST (${halfGst}%)</span><span>₹${data.sgstTotal.toFixed(2)}</span></div>
          ` : ''}
          <div class="totals-row"><span>Round Off</span><span>${data.roundOff >= 0 ? '+' : ''}${data.roundOff.toFixed(2)}</span></div>
          <div class="totals-row totals-total"><span>Grand Total</span><span>₹${data.grandTotal.toFixed(2)}</span></div>
        </div>
        <div class="payment-info">
          <p>Payment: <strong>${data.paymentStatus}</strong>
          ${data.paidAmount > 0 ? `| Paid: ₹${data.paidAmount.toFixed(2)} | Method: ${data.paymentMethod}` : ''}
          ${data.balance > 0 ? `| Balance: ₹${data.balance.toFixed(2)}` : ''}</p>
        </div>
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>${s.shop_name || ''} | AD's Creation</p>
        </div>
        <div class="no-print" style="text-align:center;margin-top:20px">
          <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer">Print</button>
          <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer">Close</button>
        </div>
      </div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => { this._isPrinting = false; }, 500);
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.BILLING_SCREEN = BILLING_SCREEN;