const SETTINGS_SCREEN = {
  _settings: null,
  _appSettings: null,
  _activeTab: 'general',

  async render() {
    return `
      <div class="settings-page">
        <div class="page-header">
          <h2>Settings</h2>
        </div>
        <div id="settings-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;
  },

  async init() {
    await this._load();
  },

  async _load() {
    try {
      const [settings, appSettings] = await Promise.all([
        API.invoke('settings:get'),
        API.invoke('settings:getAppSettings')
      ]);
      this._settings = settings || {};
      this._appSettings = appSettings || {};
      this._renderTabs();
    } catch (err) {
      document.getElementById('settings-content').innerHTML = `
        <div class="alert alert-error">Failed to load settings: ${this._escape(err.message)}</div>
      `;
    }
  },

  _renderTabs() {
    const container = document.getElementById('settings-content');
    if (!container) return;

    const tabs = [
      { id: 'general', label: 'General' },
      { id: 'tax', label: 'Tax Info' },
      { id: 'invoice', label: 'Invoice' },
      { id: 'preferences', label: 'Preferences' },
      { id: 'diagnostics', label: 'Database & Health' },
      { id: 'about', label: 'About' }
    ];

    container.innerHTML = `
      <div class="settings-tabs">
        ${tabs.map(t => `
          <button class="settings-tab ${this._activeTab === t.id ? 'active' : ''}"
                  data-tab="${t.id}">${t.label}</button>
        `).join('')}
      </div>
      <div id="settings-tab-content" class="settings-tab-content">
        ${this._renderTabContent()}
      </div>
    `;

    container.querySelectorAll('.settings-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeTab = btn.dataset.tab;
        this._renderTabs();
      });
    });

    this._bindFormEvents();
    this._bindDiagnosticsEvents();
  },

  _renderTabContent() {
    const s = this._settings;
    switch (this._activeTab) {
      case 'general': return this._renderGeneral(s);
      case 'tax': return this._renderTax(s);
      case 'invoice': return this._renderInvoice(s);
      case 'preferences': return this._renderPreferences(s, this._appSettings);
      case 'diagnostics': return this._renderDiagnostics();
      case 'about': return this._renderAbout();
      default: return '';
    }
  },

  _renderDiagnostics() {
    return `
      <div class="settings-card" style="margin-bottom:20px;">
        <h3>💾 Storage Drive & Mirror Copies</h3>
        <p class="text-muted" style="font-size:13px;margin-bottom:16px;">
          Manage primary database storage and create 1-click mirror backups to secondary drives.
        </p>
        <div style="display:flex;gap:12px;align-items:center;">
          <button class="btn btn-primary" onclick="if(window.DASHBOARD_SCREEN) window.DASHBOARD_SCREEN.navigate('backup');">
            💾 Open Storage & Backup Management
          </button>
        </div>
      </div>

      <div class="settings-card">
        <h3>🔍 Database Health & Integrity Diagnostic</h3>
        <p class="text-muted" style="font-size:13px;margin-bottom:16px;">
          Run an automated scan of the active Hardware Vault database to verify customer counts, index health, and table references.
        </p>
        <button class="btn btn-primary" id="run-integrity-check-btn">🔍 Run Integrity Check</button>
        <div id="diagnostics-result" style="margin-top:16px;"></div>
      </div>
    `;
  },

  _renderAbout() {
    return `
      <div class="about-section">
        <div class="about-logo">JE</div>
        <h2 class="about-name">Jwellers Edith</h2>
        <p class="about-version">Version 1.3.0</p>
        <p class="about-creator">by AD's Creation</p>
        <p class="about-desc">Professional Jewellery Shop Management Software</p>
        <div class="about-info">
          <div class="about-row"><span>Database Schema</span><span>v${this._escape(String(this._appSettings?.schema_version || '1'))}</span></div>
          <div class="about-row"><span>Database Created</span><span>${this._escape(this._appSettings?.db_created_at ? new Date(this._appSettings.db_created_at).toLocaleDateString() : '--')}</span></div>
          <div class="about-row"><span>Backup Count</span><span>Loading...</span></div>
        </div>
      </div>`;
  },

  _renderGeneral(s) {
    const canEdit = APP_STATE.hasPermission('settings.edit');
    return `
      <div class="settings-card">
        <h3>General Information</h3>
        <form id="settings-general-form" onsubmit="return false">
          <div class="form-row">
            <div class="form-group">
              <label for="set-shop-name">Shop Name</label>
              <input type="text" id="set-shop-name" class="form-control" value="${this._escape(s.shop_name || '')}" ${canEdit ? '' : 'disabled'}>
            </div>
            <div class="form-group">
              <label for="set-owner-name">Owner Name</label>
              <input type="text" id="set-owner-name" class="form-control" value="${this._escape(s.owner_name || '')}" ${canEdit ? '' : 'disabled'}>
            </div>
          </div>
          <div class="form-group">
            <label for="set-address">Address</label>
            <textarea id="set-address" class="form-control" rows="2" ${canEdit ? '' : 'disabled'}>${this._escape(s.address || '')}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="set-city">City</label>
              <input type="text" id="set-city" class="form-control" value="${this._escape(s.city || '')}" ${canEdit ? '' : 'disabled'}>
            </div>
            <div class="form-group">
              <label for="set-phone">Phone</label>
              <input type="tel" id="set-phone" class="form-control" value="${this._escape(s.phone || '')}" ${canEdit ? '' : 'disabled'}>
            </div>
          </div>
          <div class="form-group">
            <label for="set-whatsapp">WhatsApp Number</label>
            <input type="tel" id="set-whatsapp" class="form-control" value="${this._escape(s.whatsapp_number || '')}" ${canEdit ? '' : 'disabled'}>
          </div>
          ${canEdit ? '<button type="submit" class="btn btn-primary" id="save-general">Save Changes</button>' : '<p class="text-muted">You do not have permission to edit settings.</p>'}
        </form>
        <div id="general-alert"></div>
      </div>
    `;
  },

  _renderTax(s) {
    const canEdit = APP_STATE.hasPermission('settings.edit');
    return `
      <div class="settings-card">
        <h3>Tax Information</h3>
        <form id="settings-tax-form" onsubmit="return false">
          <div class="form-row">
            <div class="form-group">
              <label for="set-gst">GST Number</label>
              <input type="text" id="set-gst" class="form-control" value="${this._escape(s.gst_number || '')}" ${canEdit ? '' : 'disabled'}>
            </div>
            <div class="form-group">
              <label for="set-pan">PAN Number</label>
              <input type="text" id="set-pan" class="form-control" value="${this._escape(s.pan_number || '')}" ${canEdit ? '' : 'disabled'}>
            </div>
          </div>
          <div class="form-group">
            <label for="set-hallmark">Hallmark Registration</label>
            <input type="text" id="set-hallmark" class="form-control" value="${this._escape(s.hallmark_registration || '')}" ${canEdit ? '' : 'disabled'}>
          </div>
          ${canEdit ? '<button type="submit" class="btn btn-primary" id="save-tax">Save Changes</button>' : ''}
        </form>
        <div id="tax-alert"></div>
      </div>
    `;
  },

  _renderInvoice(s) {
    const canEdit = APP_STATE.hasPermission('settings.edit');
    return `
      <div class="settings-card">
        <h3>Invoice Configuration</h3>
        <form id="settings-invoice-form" onsubmit="return false">
          <div class="form-row">
            <div class="form-group">
              <label for="set-inv-prefix">Invoice Prefix</label>
              <input type="text" id="set-inv-prefix" class="form-control" value="${this._escape(s.invoice_prefix || 'INV-')}" ${canEdit ? '' : 'disabled'}>
            </div>
            <div class="form-group">
              <label for="set-inv-next">Next Invoice Number</label>
              <input type="number" id="set-inv-next" class="form-control" value="${s.invoice_next_number || 1}" min="1" ${canEdit ? '' : 'disabled'}>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="set-inv-year">Year Format</label>
              <select id="set-inv-year" class="form-control" ${canEdit ? '' : 'disabled'}>
                <option value="YYYY" ${s.invoice_year_format === 'YYYY' ? 'selected' : ''}>YYYY (e.g. 2026)</option>
                <option value="YY" ${s.invoice_year_format === 'YY' ? 'selected' : ''}>YY (e.g. 26)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="set-gst-rate">Default GST Rate (%)</label>
              <input type="number" id="set-gst-rate" class="form-control" value="${s.default_gst_rate || 3}" min="0" max="100" step="0.1" ${canEdit ? '' : 'disabled'}>
            </div>
          </div>
          <div class="form-group">
            <label for="set-currency">Currency Symbol</label>
            <input type="text" id="set-currency" class="form-control" value="${this._escape(s.currency || '₹')}" maxlength="10" ${canEdit ? '' : 'disabled'}>
          </div>
          ${canEdit ? '<button type="submit" class="btn btn-primary" id="save-invoice">Save Changes</button>' : ''}
        </form>
        <div id="invoice-alert"></div>
      </div>
    `;
  },

  _renderPreferences(s, app) {
    const canEdit = APP_STATE.hasPermission('settings.edit');
    return `
      <div class="settings-card">
        <h3>Backup Preferences</h3>
        <form id="settings-prefs-form" onsubmit="return false">
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" id="set-auto-backup" ${s.backup_auto_enabled ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
              <span>Enable automatic backups</span>
            </label>
          </div>
          <div class="form-row" id="backup-interval-row" style="${s.backup_auto_enabled ? '' : 'display:none'}">
            <div class="form-group">
              <label for="set-backup-interval">Backup Interval (days)</label>
              <input type="number" id="set-backup-interval" class="form-control" value="${s.backup_auto_interval_days || 7}" min="1" max="365" ${canEdit ? '' : 'disabled'}>
            </div>
            <div class="form-group">
              <label for="set-backup-folder">Backup Folder</label>
              <input type="text" id="set-backup-folder" class="form-control" value="${this._escape(s.backup_auto_folder || '')}" placeholder="Leave empty for default" ${canEdit ? '' : 'disabled'}>
            </div>
          </div>

          <h3 style="margin-top:24px">Display Preferences</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="set-date-format">Date Format</label>
              <select id="set-date-format" class="form-control" ${canEdit ? '' : 'disabled'}>
                <option value="DD/MM/YYYY" ${s.date_format === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
                <option value="MM/DD/YYYY" ${s.date_format === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
                <option value="YYYY-MM-DD" ${s.date_format === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
              </select>
            </div>
            <div class="form-group">
              <label for="set-theme">Theme</label>
              <select id="set-theme" class="form-control" ${canEdit ? '' : 'disabled'}>
                <option value="light" ${app.theme === 'light' ? 'selected' : ''}>Light</option>
                <option value="dark" ${app.theme === 'dark' ? 'selected' : ''}>Dark</option>
              </select>
            </div>
          </div>
          ${canEdit ? '<button type="submit" class="btn btn-primary" id="save-prefs">Save Changes</button>' : ''}
        </form>
        <div id="prefs-alert"></div>
      </div>
    `;
  },

  _bindFormEvents() {
    if (!APP_STATE.hasPermission('settings.edit')) return;

    const toggleBackup = document.getElementById('set-auto-backup');
    if (toggleBackup) {
      toggleBackup.addEventListener('change', () => {
        const row = document.getElementById('backup-interval-row');
        if (row) row.style.display = toggleBackup.checked ? '' : 'none';
      });
    }

    const formMap = {
      'settings-general-form': {
        alertId: 'general-alert',
        fields: () => ({
          shop_name: this._val('set-shop-name'),
          owner_name: this._val('set-owner-name'),
          address: this._val('set-address'),
          city: this._val('set-city'),
          phone: this._val('set-phone'),
          whatsapp_number: this._val('set-whatsapp')
        })
      },
      'settings-tax-form': {
        alertId: 'tax-alert',
        fields: () => ({
          gst_number: this._val('set-gst'),
          pan_number: this._val('set-pan'),
          hallmark_registration: this._val('set-hallmark')
        })
      },
      'settings-invoice-form': {
        alertId: 'invoice-alert',
        fields: () => ({
          invoice_prefix: this._val('set-inv-prefix'),
          invoice_next_number: this._valInt('set-inv-next'),
          invoice_year_format: this._val('set-inv-year'),
          default_gst_rate: this._valFloat('set-gst-rate'),
          currency: this._val('set-currency')
        })
      },
      'settings-prefs-form': {
        alertId: 'prefs-alert',
        fields: () => ({
          enable_inventory: 1,
          backup_auto_enabled: document.getElementById('set-auto-backup')?.checked ? 1 : 0,
          backup_auto_interval_days: this._valInt('set-backup-interval'),
          backup_auto_folder: this._val('set-backup-folder'),
          date_format: this._val('set-date-format'),
          theme: document.getElementById('set-theme')?.value || 'light'
        })
      }
    };

    for (const [formId, config] of Object.entries(formMap)) {
      const form = document.getElementById(formId);
      if (!form) continue;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this._saveSettings(config.fields(), config.alertId);
      });
    }
  },

  _bindDiagnosticsEvents() {
    const runBtn = document.getElementById('run-integrity-check-btn');
    const syncBtn = document.getElementById('force-sync-app-btn');
    const resultDiv = document.getElementById('diagnostics-result');

    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true;
        runBtn.textContent = 'Running Scan...';
        if (resultDiv) resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div> Scanning database tables...</div>';

        try {
          const res = await API.invoke('customer:verifyIntegrity');
          if (resultDiv) {
            const statusClass = res.healthy ? 'alert-success' : 'alert-error';
            const statusText = res.healthy ? '✅ Database Healthy — All Records Verified' : '⚠️ Diagnostic Issues Detected';
            const issuesHtml = res.issuesFound.length > 0
              ? `<ul style="margin:8px 0 0 20px;">${res.issuesFound.map(i => `<li>${this._escape(i)}</li>`).join('')}</ul>`
              : '<p style="margin-top:4px;">No orphaned records or duplicate IDs found.</p>';

            resultDiv.innerHTML = `
              <div class="alert ${statusClass}">
                <strong>${statusText}</strong>
                ${issuesHtml}
              </div>
              <div class="stat-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:12px;">
                <div style="background:var(--bg-body);padding:12px;border-radius:var(--radius);text-align:center;">
                  <div style="font-size:20px;font-weight:700;color:var(--primary)">${res.totalCustomers}</div>
                  <div style="font-size:12px;color:var(--text-muted)">Total Customers</div>
                </div>
                <div style="background:var(--bg-body);padding:12px;border-radius:var(--radius);text-align:center;">
                  <div style="font-size:20px;font-weight:700;color:var(--success)">${res.activeCustomers}</div>
                  <div style="font-size:12px;color:var(--text-muted)">Active Customers</div>
                </div>
                <div style="background:var(--bg-body);padding:12px;border-radius:var(--radius);text-align:center;">
                  <div style="font-size:20px;font-weight:700;color:var(--warning,#e67e22)">${res.archivedCustomers}</div>
                  <div style="font-size:12px;color:var(--text-muted)">Archived</div>
                </div>
                <div style="background:var(--bg-body);padding:12px;border-radius:var(--radius);text-align:center;">
                  <div style="font-size:20px;font-weight:700;color:var(--danger)">${res.deletedCustomers}</div>
                  <div style="font-size:12px;color:var(--text-muted)">Soft Deleted</div>
                </div>
              </div>
            `;
          }
        } catch (err) {
          if (resultDiv) resultDiv.innerHTML = `<div class="alert alert-error">Scan failed: ${this._escape(err.message)}</div>`;
        } finally {
          runBtn.disabled = false;
          runBtn.textContent = '🔍 Run Integrity Check';
        }
      });
    }

    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('customer-changed'));
        if (typeof Toast !== 'undefined') Toast.show('Broadcasted sync signal to all modules', 'success');
      });
    }

    },

  async _saveSettings(fields, alertId) {
    const btn = document.querySelector(`#${alertId}`)?.previousElementSibling?.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      await API.invoke('settings:update', fields);
      if (fields.theme) {
        localStorage.setItem('app_theme', fields.theme);
        document.documentElement.setAttribute('data-theme', fields.theme);
        try {
          await API.invoke('settings:updateAppSettings', { theme: fields.theme });
        } catch (_) {}
        if (typeof Toast !== 'undefined') Toast.show(`Theme switched to ${fields.theme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
      }
      this._showSuccess(alertId, 'Settings saved successfully');
      this._settings = await API.invoke('settings:get');
    } catch (err) {
      this._showError(alertId, err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
  },

  _val(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    const v = el.value.trim();
    return v || undefined;
  },

  _valInt(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    const v = parseInt(el.value, 10);
    return isNaN(v) ? undefined : v;
  },

  _valFloat(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    const v = parseFloat(el.value);
    return isNaN(v) ? undefined : v;
  },

  _showError(alertId, msg) {
    const el = document.getElementById(alertId);
    if (el) el.innerHTML = `<div class="alert alert-error">${this._escape(msg)}</div>`;
  },

  _showSuccess(alertId, msg) {
    const el = document.getElementById(alertId);
    if (el) el.innerHTML = `<div class="alert alert-success">${this._escape(msg)}</div>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 3000);
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
window.SETTINGS_SCREEN = SETTINGS_SCREEN;