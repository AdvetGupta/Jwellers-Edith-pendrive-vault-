const SHOP_SETUP_SCREEN = {
  render() {
    return `
      <div class="setup-screen">
        <div class="setup-container">
          <div class="setup-header">
            <div class="setup-icon">JE</div>
            <h1>Welcome to Jwellers Edith</h1>
            <p>Let's set up your shop. Fill in the details below — you can change them anytime from Settings.</p>
          </div>
          <div id="setup-alert"></div>
          <form id="setup-form" onsubmit="return false">
            <div class="setup-section">
              <h2>Shop Information</h2>
              <div class="form-row">
                <div class="form-group">
                  <label for="setup-shop-name">Shop Name *</label>
                  <input type="text" id="setup-shop-name" class="form-control" placeholder="e.g. Jwellers Edith" autofocus>
                </div>
                <div class="form-group">
                  <label for="setup-owner-name">Owner Name</label>
                  <input type="text" id="setup-owner-name" class="form-control" placeholder="Owner name" value="${this._escape(APP_STATE.get('user')?.displayName || '')}">
                </div>
              </div>
              <div class="form-group">
                <label for="setup-address">Address</label>
                <textarea id="setup-address" class="form-control" rows="2" placeholder="Shop address"></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="setup-city">City</label>
                  <input type="text" id="setup-city" class="form-control" placeholder="City">
                </div>
                <div class="form-group">
                  <label for="setup-phone">Phone</label>
                  <input type="tel" id="setup-phone" class="form-control" placeholder="Phone number">
                </div>
              </div>
              <div class="form-group">
                <label for="setup-whatsapp">WhatsApp Number</label>
                <input type="tel" id="setup-whatsapp" class="form-control" placeholder="WhatsApp number">
              </div>
            </div>
            <div class="setup-section">
              <h2>Tax Information <span class="setup-optional">(Optional)</span></h2>
              <div class="form-row">
                <div class="form-group">
                  <label for="setup-gst">GST Number</label>
                  <input type="text" id="setup-gst" class="form-control" placeholder="GSTIN">
                </div>
                <div class="form-group">
                  <label for="setup-pan">PAN Number</label>
                  <input type="text" id="setup-pan" class="form-control" placeholder="PAN">
                </div>
              </div>
            </div>
            <div class="setup-actions">
              <button type="button" class="btn btn-secondary" id="setup-skip-btn">Skip — I'll do this later</button>
              <button type="submit" class="btn btn-primary btn-lg" id="setup-save-btn">Save & Continue</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async init() {
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._save();
    });

    document.getElementById('setup-skip-btn').addEventListener('click', () => {
      this._complete();
    });
  },

  async _save() {
    const shopName = document.getElementById('setup-shop-name').value.trim();
    if (!shopName) {
      this._showError('Shop name is required');
      return;
    }

    const btn = document.getElementById('setup-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const data = {
        shop_name: shopName,
        owner_name: document.getElementById('setup-owner-name').value.trim() || undefined,
        address: document.getElementById('setup-address').value.trim() || undefined,
        city: document.getElementById('setup-city').value.trim() || undefined,
        phone: document.getElementById('setup-phone').value.trim() || undefined,
        whatsapp_number: document.getElementById('setup-whatsapp').value.trim() || undefined,
        gst_number: document.getElementById('setup-gst').value.trim() || undefined,
        pan_number: document.getElementById('setup-pan').value.trim() || undefined
      };

      await API.invoke('settings:completeSetup', data);
      this._complete();
    } catch (err) {
      this._showError(err.message || 'Failed to save settings');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save & Continue';
    }
  },

  _complete() {
    APP_STATE.set('screen', 'app');
    APP.render();
  },

  _showError(msg) {
    const el = document.getElementById('setup-alert');
    if (el) el.innerHTML = `<div class="alert alert-error">${this._escapeHtml(msg)}</div>`;
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
window.SHOP_SETUP_SCREEN = SHOP_SETUP_SCREEN;