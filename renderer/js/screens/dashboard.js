const DASHBOARD_SCREEN = {
  _currentSection: 'dashboard',
  _navigationParams: null,

  render() {
    const user = APP_STATE.get('user');
    const initial = user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';

    return `
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>Jwellers Edith</h2>
            <div class="sidebar-creator">AD's Creation</div>
          </div>
          <nav class="sidebar-nav">
            ${this._renderNav()}
          </nav>
          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="sidebar-avatar">${initial}</div>
              <div class="sidebar-user-info">
                <div class="sidebar-user-name">${this._escape(user?.displayName || 'User')}</div>
                <div class="sidebar-user-role">${this._escape(user?.roleName || '')}</div>
              </div>
            </div>
            <button class="sidebar-logout" id="btn-logout">Sign Out</button>
          </div>
        </aside>
        <main class="main-content">
          <div class="topbar" style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;">
              <button class="sidebar-slider-toggle" id="btn-sidebar-toggle" title="Slide / Toggle Menu (स्क्रीन चौड़ी करें)">☰</button>
              <h1 id="section-title">Dashboard</h1>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <!-- Storage Status Indicator (Discreet) -->
              <div class="vault-status-pill locked" id="vault-status-pill" title="Storage Status (Click to view Backup & Storage)">
                <span>💾</span> Storage: --
              </div>

              <!-- Discreet Lock Button -->
              <button class="btn btn-sm btn-outline" id="btn-emergency-lock" style="font-weight:600;display:flex;align-items:center;gap:6px;padding:6px 12px;cursor:pointer;" title="Lock Screen (Ctrl+L or Double Esc)">
                <span>🔒</span> Lock Screen
              </button>

              <!-- Zoom In / Zoom Out Controls -->
              <div style="display:inline-flex;align-items:center;background:var(--bg-body);border:1px solid var(--border);border-radius:6px;padding:2px 5px;gap:2px;" title="Zoom (Ctrl + / Ctrl -)">
                <button id="btn-zoom-out" class="btn btn-xs btn-outline" style="padding:2px 8px;font-size:13px;font-weight:700;line-height:1;border:none;background:transparent;cursor:pointer;" title="Zoom Out (Ctrl -)">−</button>
                <span id="zoom-level-label" style="font-size:12px;font-weight:700;min-width:40px;text-align:center;cursor:pointer;user-select:none;" title="Click to Reset to 100% (Ctrl 0)">100%</span>
                <button id="btn-zoom-in" class="btn btn-xs btn-outline" style="padding:2px 8px;font-size:13px;font-weight:700;line-height:1;border:none;background:transparent;cursor:pointer;" title="Zoom In (Ctrl +)">+</button>
              </div>

              <button class="btn btn-sm btn-outline" id="lang-toggle-btn" style="font-weight:600;">🌐 <span id="current-lang-label">EN / हिंदी</span></button>
              <button class="btn btn-sm btn-outline" id="theme-toggle-btn" style="font-weight:600;" title="Toggle Light / Dark Mode">
                <span id="theme-icon">🌙</span> <span id="theme-label">Dark</span>
              </button>
            </div>
          </div>
          <div class="content-area" id="content-area">
            <div class="loading"><div class="spinner"></div></div>
          </div>
        </main>
      </div>
    `;
  },

  async init() {
    this._bindNavEvents();

    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    if (localStorage.getItem('sidebar_collapsed') === 'true' && sidebar) {
      sidebar.classList.add('collapsed');
    }
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
      });
    }

    // Zoom In / Zoom Out Controller (with persistent preference and Ctrl +/- shortcuts)
    let currentZoom = parseFloat(localStorage.getItem('app_zoom_factor')) || 1.0;
    const applyZoom = (z) => {
      currentZoom = Math.min(1.5, Math.max(0.7, Math.round(z * 10) / 10));
      document.body.style.zoom = currentZoom;
      localStorage.setItem('app_zoom_factor', currentZoom);
      const label = document.getElementById('zoom-level-label');
      if (label) label.textContent = `${Math.round(currentZoom * 100)}%`;
    };
    applyZoom(currentZoom);

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => applyZoom(currentZoom + 0.1));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => applyZoom(currentZoom - 0.1));
    document.getElementById('zoom-level-label')?.addEventListener('click', () => applyZoom(1.0));

    if (!window._zoomShortcutsBound) {
      window._zoomShortcutsBound = true;
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            applyZoom(currentZoom + 0.1);
          } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            applyZoom(currentZoom - 0.1);
          } else if (e.key === '0') {
            e.preventDefault();
            applyZoom(1.0);
          }
        }
      });
    }

    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        const nextLang = (window.I18N && window.I18N.getLang() === 'hi') ? 'en' : 'hi';
        if (window.I18N) window.I18N.setLang(nextLang);
        const nav = document.querySelector('.sidebar-nav');
        if (nav) nav.innerHTML = this._renderNav();
        const label = document.getElementById('current-lang-label');
        if (label) label.textContent = nextLang === 'hi' ? 'हिंदी (Hindi)' : 'English';
        if (typeof Toast !== 'undefined') Toast.show(nextLang === 'hi' ? 'भाषा: हिंदी सेट की गई' : 'Language set to English', 'info');
      });
    }

    const themeBtn = document.getElementById('theme-toggle-btn');
    const updateThemeBtn = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const icon = document.getElementById('theme-icon');
      const label = document.getElementById('theme-label');
      if (icon && label) {
        if (currentTheme === 'dark') {
          icon.textContent = '🌙';
          label.textContent = 'Dark';
        } else {
          icon.textContent = '☀️';
          label.textContent = 'Light';
        }
      }
    };
    updateThemeBtn();

    if (themeBtn) {
      themeBtn.addEventListener('click', async () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('app_theme', nextTheme);
        updateThemeBtn();
        try {
          await API.invoke('settings:updateAppSettings', { theme: nextTheme });
        } catch (_) {}
        if (typeof Toast !== 'undefined') {
          Toast.show(`Theme: ${nextTheme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}`, 'info');
        }
      });
    }

    await this._renderContent();
  },


  _bindNavEvents() {
    // Bind nav clicks via event delegation — works even if CSP blocks inline onclick
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-item:not(.disabled)');
      if (!btn) return;
      const section = btn.dataset.section;
      if (section) this.navigate(section);
    });
  },

  _renderNav() {
    const t = (k, fb) => window.I18N ? window.I18N.t(k, fb) : fb;
    const items = [
      { section: window.I18N && window.I18N.getLang() === 'hi' ? 'मुख्य' : 'Main' },
      { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: '◉', perm: null },

      { section: window.I18N && window.I18N.getLang() === 'hi' ? 'प्रबंधन' : 'Management' },
      { id: 'customers', label: t('customers', 'Customers'), icon: '👥', perm: 'customer.view' },
      { id: 'inventory', label: t('inventory', 'Inventory'), icon: '📦', perm: 'inventory.view' },
      { id: 'billing', label: t('billing', 'Billing'), icon: '📄', perm: 'bill.view' },
      { id: 'khata', label: t('khata', 'Khata'), icon: '📒', perm: 'khata.view' },
      { id: 'girvi', label: t('girvi', 'Girvi'), icon: '💍', perm: 'customer.view' },

      { section: window.I18N && window.I18N.getLang() === 'hi' ? 'रिपोर्ट्स' : 'Reports' },
      { id: 'reports', label: t('reports', 'Reports & Setup Guide'), icon: '📊', perm: null },

      { section: window.I18N && window.I18N.getLang() === 'hi' ? 'प्रशासन' : 'Administration' },
      { id: 'staff', label: t('staff', 'Staff'), icon: '👤', perm: 'staff.create' },
      { id: 'settings', label: t('settings', 'Settings'), icon: '⚙', perm: 'settings.view' },
      { id: 'backup', label: t('backup', 'Backup'), icon: '💾', perm: 'backup.create' },
      { id: 'activity', label: t('activity', 'Activity Log'), icon: '📋', perm: 'activity.view' }
    ];

    let html = '';
    for (const item of items) {
      if (item.section) {
        html += `<div class="nav-section-title">${item.section}</div>`;
      } else {
        const disabled = item.perm && !APP_STATE.hasPermission(item.perm);
        const activeClass = this._currentSection === item.id ? 'active' : '';
        const disabledClass = disabled ? 'disabled' : '';
        // Use data-section for event-delegation binding; also keep onclick as fallback for older Electron builds
        const navAttrs = disabled ? '' : `data-section="${item.id}" onclick="window.DASHBOARD_SCREEN && window.DASHBOARD_SCREEN.navigate('${item.id}')"`;
        html += `<button class="nav-item ${activeClass} ${disabledClass}" ${navAttrs}>
          <span class="nav-icon">${item.icon}</span> ${item.label}
        </button>`;
      }
    }
    return html;
  },

  async navigate(section, params) {
    if (!section || (section === this._currentSection && !params)) return;
    this._navigationParams = params || null;
    this._currentSection = section;
    this._updateNavActiveState();
    await this._renderContent();
  },

  _updateNavActiveState() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      const s = btn.dataset.section;
      if (s) btn.classList.toggle('active', s === this._currentSection);
    });
  },

  async _renderContent() {
    const area = document.getElementById('content-area');
    const title = document.getElementById('section-title');
    if (!area) return;

    const titles = {
      dashboard: 'Dashboard',
      vault: 'Hardware Pen Drive Vault',
      customers: 'Customers',
      inventory: 'Inventory',
      billing: 'Billing',
      khata: 'Khata / Ledger',
      girvi: 'Girvi / Pledge',
      reports: 'Reports',
      staff: 'Staff Management',
      settings: 'Settings',
      backup: 'Backup',
      activity: 'Activity Log'
    };

    if (title) title.textContent = titles[this._currentSection] || 'Dashboard';

    switch (this._currentSection) {
      case 'vault':
        area.innerHTML = await VAULT_SCREEN.render();
        await VAULT_SCREEN.init();
        break;
      case 'customers':
        area.innerHTML = await CUSTOMER_SCREEN.render();
        await CUSTOMER_SCREEN.init();
        break;
      case 'inventory':
        area.innerHTML = await PRODUCT_SCREEN.render();
        await PRODUCT_SCREEN.init();
        break;
      case 'staff':
        area.innerHTML = STAFF_SCREEN.render();
        await STAFF_SCREEN.init();
        break;
      case 'settings':
        area.innerHTML = await SETTINGS_SCREEN.render();
        await SETTINGS_SCREEN.init();
        break;
      case 'dashboard':
        await this._renderDashboard();
        break;
      case 'khata':
        area.innerHTML = KHATA_SCREEN.render();
        await KHATA_SCREEN.init();
        break;
      case 'girvi':
        await GIRVI_SCREEN.render(area);
        await GIRVI_SCREEN.init();
        break;
      case 'billing':
        area.innerHTML = await BILLING_SCREEN.render();
        await BILLING_SCREEN.init(this._navigationParams);
        break;
      case 'reports':
        area.innerHTML = REPORTS_SCREEN.render();
        await REPORTS_SCREEN.init();
        break;
      case 'backup':
        area.innerHTML = BACKUP_SCREEN.render();
        await BACKUP_SCREEN.init();
        break;
      case 'activity':
        area.innerHTML = ACTIVITY_SCREEN.render();
        await ACTIVITY_SCREEN.init();
        break;
      default:
        area.innerHTML = this._renderPlaceholder(titles[this._currentSection] || 'Dashboard');
    }
    this._navigationParams = null;
  },

  async _renderDashboard() {
    const user = APP_STATE.get('user');
    const area = document.getElementById('content-area');
    if (!area) return;

    area.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    let data;
    try {
      data = await API.invoke('report:dashboard');
    } catch {
      data = {
        todaySales: { billCount: 0, totalRevenue: 0 },
        totalCustomers: 0, outstandingKhata: 0, lowStockCount: 0,
        recentBills: [], salesTrend: [], paymentMethods: [],
        monthlySales: [], topProducts: []
      };
    }

    const ts = data.todaySales || {};

    area.innerHTML = `
      <div class="welcome-message" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <h2 style="margin:0;">Welcome, ${this._escape(user?.displayName || 'User')}</h2>
        <button class="btn btn-secondary btn-sm" onclick="window.DASHBOARD_SCREEN && window.DASHBOARD_SCREEN.navigate('reports')" style="border-color:var(--primary); color:var(--primary); font-weight:700;">
          📘 New Setup & Operating Guide
        </button>
      </div>

      <div class="dash-cards">
        <div class="dash-card dash-card-today">
          <div class="dash-card-icon">📊</div>
          <div class="dash-card-body">
            <div class="dash-card-label">Today's Sales</div>
            <div class="dash-card-value">₹${(ts.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div class="dash-card-sub">${ts.billCount || 0} bills</div>
          </div>
        </div>
        <div class="dash-card dash-card-customers">
          <div class="dash-card-icon">👥</div>
          <div class="dash-card-body">
            <div class="dash-card-label">Total Customers</div>
            <div class="dash-card-value">${data.totalCustomers || 0}</div>
          </div>
        </div>
        <div class="dash-card dash-card-khata">
          <div class="dash-card-icon">📒</div>
          <div class="dash-card-body">
            <div class="dash-card-label">Total Dues</div>
            <div class="dash-card-value">₹${(data.outstandingKhata || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div class="dash-card dash-card-stock">
          <div class="dash-card-icon">📦</div>
          <div class="dash-card-body">
            <div class="dash-card-label">Low Stock Items</div>
            <div class="dash-card-value">${data.lowStockCount || 0}</div>
            <div class="dash-card-sub">need restocking</div>
          </div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="dash-panel dash-panel-recent">
          <h3>Recent Bills</h3>
          ${data.recentBills && data.recentBills.length ? this._renderRecentBillsTable(data.recentBills) : '<p class="text-muted">No bills yet</p>'}
        </div>
        <div class="dash-panel dash-panel-chart">
          <h3>Sales Trend (7 days)</h3>
          ${data.salesTrend && data.salesTrend.length ? this._renderBarChart(data.salesTrend) : '<p class="text-muted">No sales data</p>'}
        </div>
      </div>

      <div class="dash-grid">
        <div class="dash-panel dash-panel-top">
          <h3>Top Products (30 days)</h3>
          ${data.topProducts && data.topProducts.length ? this._renderTopProducts(data.topProducts) : '<p class="text-muted">No product sales</p>'}
        </div>
        <div class="dash-panel dash-panel-pay">
          <h3>Payment Methods (30 days)</h3>
          ${data.paymentMethods && data.paymentMethods.length ? this._renderPaymentMethods(data.paymentMethods) : '<p class="text-muted">No payments</p>'}
        </div>
      </div>
    `;
  },

  _renderRecentBillsTable(bills) {
    return `
      <table class="data-table dash-recent-table">
        <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${bills.map(b => `
          <tr>
            <td>${this._escape(b.invoice_number)}</td>
            <td>${this._escape(b.customer_name || 'Walk-in')}</td>
            <td>₹${(b.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td><span class="badge badge-${b.payment_status === 'paid' ? 'success' : b.payment_status === 'partial' ? 'warning' : 'danger'}">${this._escape(b.payment_status)}</span></td>
          </tr>`).join('')}</tbody>
      </table>`;
  },

  _renderBarChart(data) {
    const maxRevenue = Math.max(...data.map(d => d.revenue || 0), 1);
    const barWidth = Math.max(30, Math.min(60, 320 / data.length));
    const bars = data.map((d, i) => {
      const h = Math.max(4, ((d.revenue || 0) / maxRevenue) * 120);
      const day = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
      return `<div class="dash-bar-item" title="${day}: ₹${(d.revenue || 0).toLocaleString('en-IN')}">
        <div class="dash-bar" style="height:${h}px;width:${barWidth}px"></div>
        <div class="dash-bar-label">${day}</div>
        <div class="dash-bar-val">₹${((d.revenue || 0) / 1000).toFixed(1)}k</div>
      </div>`;
    }).join('');
    return `<div class="dash-bar-chart">${bars}</div>`;
  },

  _renderTopProducts(products) {
    const maxQty = Math.max(...products.map(p => p.qty_sold || 0), 1);
    return `<div class="dash-ranked-list">${products.map(p => `
      <div class="dash-ranked-item">
        <div class="dash-ranked-name">${this._escape(p.product_name)}</div>
        <div class="dash-ranked-bar-bg"><div class="dash-ranked-bar" style="width:${((p.qty_sold || 0) / maxQty) * 100}%"></div></div>
        <div class="dash-ranked-val">${p.qty_sold || 0} sold — ₹${(p.revenue || 0).toLocaleString('en-IN')}</div>
      </div>`).join('')}</div>`;
  },

  _renderPaymentMethods(methods) {
    const total = methods.reduce((s, m) => s + (m.count || 0), 0);
    return `<div class="dash-pay-grid">${methods.map(m => `
      <div class="dash-pay-item">
        <div class="dash-pay-method">${this._escape(m.payment_method)}</div>
        <div class="dash-pay-count">${m.count || 0} txns</div>
        <div class="dash-pay-amt">₹${(m.total || 0).toLocaleString('en-IN')}</div>
        <div class="dash-pay-pct">${total > 0 ? ((m.count / total) * 100).toFixed(0) : 0}%</div>
      </div>`).join('')}</div>`;
  },

  _renderPlaceholder(name) {
    return `
      <div class="welcome-placeholder">
        <h2>${this._escape(name)}</h2>
        <p>This module will be available in the next update.</p>
      </div>
    `;
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};


// Expose to window so inline onclick handlers can reach this (const is script-scope, not window-scope)
window.DASHBOARD_SCREEN = DASHBOARD_SCREEN;
