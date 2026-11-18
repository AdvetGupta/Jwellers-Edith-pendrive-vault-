const AUTH_SCREEN = {
  render() {
    return `
      <div class="auth-screen" style="position:relative;">
        <button id="auth-theme-toggle" class="btn btn-sm btn-outline" style="position:absolute;top:20px;right:20px;font-weight:600;z-index:10;cursor:pointer;" title="Toggle Light / Dark Mode">
          <span id="auth-theme-icon">🌙</span> <span id="auth-theme-label">Dark</span>
        </button>
        <div class="auth-left">
          <div class="auth-brand">
            <div class="auth-brand-icon">JE</div>
            <h1>Jwellers Edith</h1>
            <p>Professional Jewellery Shop Management</p>
            <div class="brand-subtle">AD's Creation</div>
          </div>
        </div>
        <div class="auth-right" id="auth-right">
          ${this._renderLoginForm()}
        </div>
      </div>
    `;
  },

  _renderLoginForm() {
    return `
      <div class="auth-card">
        <h2>Welcome Back</h2>
        <p class="auth-subtitle">Sign in to your account</p>
        <div id="auth-alert"></div>
        <form id="login-form" onsubmit="return false">
          <div class="form-group">
            <label for="login-username">Username</label>
            <input type="text" id="login-username" class="form-control" placeholder="Enter username" autocomplete="username" autofocus>
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <div class="password-wrapper">
              <input type="password" id="login-password" class="form-control" placeholder="Enter password" autocomplete="current-password">
              <button type="button" class="password-toggle" id="toggle-password" tabindex="-1">Show</button>
            </div>
          </div>
          <button type="submit" id="login-btn" class="btn btn-primary btn-lg" style="width:100%;margin-top:8px">Sign In</button>
        </form>
        <div class="auth-footer" style="margin-top:20px;">
          <a id="goto-create-owner">Create Owner Account</a>
        </div>
      </div>
    `;
  },

  _renderCreateOwnerForm() {
    return `
      <div class="auth-card">
        <h2>Welcome to Jwellers Edith</h2>
        <p class="auth-subtitle">Create your Owner account to get started</p>
        <div id="auth-alert"></div>
        <form id="create-owner-form" onsubmit="return false">
          <div class="form-group">
            <label for="owner-name">Name</label>
            <input type="text" id="owner-name" class="form-control" placeholder="Your full name" autocomplete="name" autofocus>
          </div>
          <div class="form-group">
            <label for="owner-username">Username</label>
            <input type="text" id="owner-username" class="form-control" placeholder="Choose a username" autocomplete="username">
          </div>
          <div class="form-group">
            <label for="owner-phone">Phone (optional)</label>
            <input type="tel" id="owner-phone" class="form-control" placeholder="Phone number" autocomplete="tel">
          </div>
          <div class="form-group">
            <label for="owner-password">Password</label>
            <div class="password-wrapper">
              <input type="password" id="owner-password" class="form-control" placeholder="At least 6 characters" autocomplete="new-password">
              <button type="button" class="password-toggle" id="toggle-password1" tabindex="-1">Show</button>
            </div>
          </div>
          <div class="form-group">
            <label for="owner-confirm">Confirm Password</label>
            <div class="password-wrapper">
              <input type="password" id="owner-confirm" class="form-control" placeholder="Repeat password" autocomplete="new-password">
              <button type="button" class="password-toggle" id="toggle-password2" tabindex="-1">Show</button>
            </div>
          </div>
          <button type="submit" id="create-owner-btn" class="btn btn-primary btn-lg" style="width:100%;margin-top:8px">Create Owner Account</button>
        </form>
        <div class="auth-footer" style="margin-top:20px;">
          Already have an account? <a id="goto-login">Sign In</a>
        </div>
      </div>
    `;
  },

  showLogin() {
    const el = document.getElementById('auth-right');
    if (el) el.innerHTML = this._renderLoginForm();
    this._bindLoginEvents();
    this._bindAuthThemeToggle();
  },

  showCreateOwner() {
    const el = document.getElementById('auth-right');
    if (el) el.innerHTML = this._renderCreateOwnerForm();
    this._bindCreateOwnerEvents();
    this._bindAuthThemeToggle();
  },

  _bindLoginEvents() {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    const toggle = document.getElementById('toggle-password');
    const pw = document.getElementById('login-password');

    if (toggle) {
      toggle.addEventListener('click', () => {
        const isPw = pw.type === 'password';
        pw.type = isPw ? 'text' : 'password';
        toggle.textContent = isPw ? 'Hide' : 'Show';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) {
        this._showError('Please enter username and password');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        const result = await API.invoke('auth:login', { username, password });
        API.setToken(result.token);
        APP_STATE.set('token', result.token);
        APP_STATE.set('user', result.user);
        await this._redirectAfterLogin();
      } catch (err) {
        this._showError(err.message || 'Login failed');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    document.getElementById('goto-create-owner')?.addEventListener('click', () => {
      this.showCreateOwner();
    });
  },

  _bindCreateOwnerEvents() {
    const form = document.getElementById('create-owner-form');
    const btn = document.getElementById('create-owner-btn');

    [1, 2].forEach(i => {
      const toggle = document.getElementById(`toggle-password${i}`);
      const pw = i === 1 ? document.getElementById('owner-password') : document.getElementById('owner-confirm');
      if (toggle) {
        toggle.addEventListener('click', () => {
          const isPw = pw.type === 'password';
          pw.type = isPw ? 'text' : 'password';
          toggle.textContent = isPw ? 'Hide' : 'Show';
        });
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('owner-name').value.trim();
      const username = document.getElementById('owner-username').value.trim();
      const phone = document.getElementById('owner-phone').value.trim();
      const password = document.getElementById('owner-password').value;
      const confirm = document.getElementById('owner-confirm').value;

      if (!name || !username || !password) {
        this._showError('Name, username, and password are required');
        return;
      }

      if (password.length < 6) {
        this._showError('Password must be at least 6 characters');
        return;
      }

      if (password !== confirm) {
        this._showError('Passwords do not match');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creating...';

      try {
        const result = await API.invoke('admin:createOwner', { displayName: name, username, password, phone: phone || undefined, referenceCode: '15112006' });
        this._showSuccess('Owner account created! Redirecting to shop setup...');
        setTimeout(async () => {
          const loginResult = await API.invoke('auth:login', { username, password });
          API.setToken(loginResult.token);
          APP_STATE.set('token', loginResult.token);
          APP_STATE.set('user', loginResult.user);
          await this._redirectAfterLogin();
        }, 1200);
      } catch (err) {
        this._showError(err.message || 'Failed to create owner');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create Owner Account';
      }
    });

    document.getElementById('goto-login')?.addEventListener('click', () => {
      this.showLogin();
    });
  },

  async _redirectAfterLogin() {
    await APP_STATE.loadPermissions();
    try {
      const { setupComplete } = await API.invoke('settings:checkSetup');
      if (!setupComplete) {
        APP_STATE.set('screen', 'setup');
      } else {
        APP_STATE.set('screen', 'app');
      }
    } catch (e) {
      APP_STATE.set('screen', 'app');
    }
    APP.render();
  },

  _showError(msg) {
    const el = document.getElementById('auth-alert');
    if (el) el.innerHTML = `<div class="alert alert-error">${this._escapeHtml(msg)}</div>`;
  },

  _showSuccess(msg) {
    const el = document.getElementById('auth-alert');
    if (el) el.innerHTML = `<div class="alert alert-success">${this._escapeHtml(msg)}</div>`;
  },

  _bindAuthThemeToggle() {
    const btn = document.getElementById('auth-theme-toggle');
    const updateIcon = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      const icon = document.getElementById('auth-theme-icon');
      const label = document.getElementById('auth-theme-label');
      if (icon && label) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
        label.textContent = theme === 'dark' ? 'Dark' : 'Light';
      }
    };
    updateIcon();

    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('app_theme', next);
        updateIcon();
        if (typeof Toast !== 'undefined') {
          Toast.show(`Theme: ${next === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}`, 'info');
        }
      });
    }
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.AUTH_SCREEN = AUTH_SCREEN;