const APP = {
  _vaultState: null,
  _lastEscTime: 0,

  async start() {
    this._initVaultCurtainListeners();
    this._initEmergencyHotkeys();

    try {
      // Query initial vault status from hardware watcher
      const initialVault = await API.invoke('vault:status');
      this._applyVaultState(initialVault);
    } catch (err) {
      console.warn('Vault initial state query notice:', err.message);
      this._applyVaultState({ isLocked: true, status: 'LOCKED' });
    }

    // Always initialize state and render normal interface (Login / Dashboard / Owner setup)
    try {
      await APP_STATE.initialize();
      this.render();
    } catch (renderErr) {
      console.error('App start render error:', renderErr);
    }
  },

  _applyVaultState(vaultState) {
    this._vaultState = vaultState;
    APP_STATE.set('vault', vaultState);

    // Stealth Decoy Mode: Never display lock curtain
    const curtain = document.getElementById('vault-lock-curtain');
    if (curtain) {
      curtain.style.display = 'none';
    }

    this.updateHeaderVaultPill(vaultState);
  },

  updateHeaderVaultPill(vaultState) {
    const pill = document.getElementById('vault-status-pill');
    if (!pill) return;

    if (vaultState && !vaultState.isLocked && vaultState.driveLetter) {
      pill.className = 'vault-status-pill connected';
      pill.innerHTML = `<span>💾</span> Storage: ${vaultState.driveLetter}`;
      pill.title = `Data Storage: ${vaultState.driveLetter} (Connected)`;
    } else {
      pill.className = 'vault-status-pill';
      pill.innerHTML = `<span>💾</span> Storage: Ready`;
      pill.title = 'Storage Drive: Ready';
    }
  },

  _initVaultCurtainListeners() {
    // Listen to background USB watcher events
    if (API.on) {
      API.on('vault:statusChange', (state) => {
        console.log('[App] Vault status change:', state);
        const wasLocked = this._vaultState?.isLocked;
        this._applyVaultState(state);

        if (wasLocked && state && !state.isLocked) {
          // Drive inserted: initialize app state and render
          if (typeof Toast !== 'undefined') Toast.show(`Pen Drive Vault Connected [${state.driveLetter}]!`, 'success');
          APP_STATE.initialize().then(() => this.render());
        }
      });

      API.on('vault:connected', (state) => {
        console.log('[App] Vault Connected:', state);
        this._applyVaultState(state);
        if (typeof Toast !== 'undefined') Toast.show(`Pen Drive Vault Connected [${state.driveLetter}]!`, 'success');
        APP_STATE.initialize().then(() => this.render());
      });

      API.on('vault:disconnected', async (info) => {
        console.warn('[App] Storage Drive Disconnected:', info);
        this._applyVaultState({ isLocked: true, status: 'LOCKED' });

        // Zero-trace RAM purge: clear sensitive in-memory user and state
        APP_STATE.reset();
        await APP_STATE.initialize();
        this.render();

        if (typeof Toast !== 'undefined') Toast.show('Storage Drive Removed. Screen reset.', 'info');
      });
    }

    // Curtain Theme Toggle (Light / Dark)
    const curtainThemeBtn = document.getElementById('curtain-theme-toggle');
    const updateCurtainThemeBtn = () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const icon = document.getElementById('curtain-theme-icon');
      const label = document.getElementById('curtain-theme-label');
      if (icon && label) {
        icon.textContent = cur === 'dark' ? '🌙' : '☀️';
        label.textContent = cur === 'dark' ? 'Dark' : 'Light';
      }
    };
    updateCurtainThemeBtn();

    curtainThemeBtn?.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('app_theme', next);
      updateCurtainThemeBtn();
    });

    // Instant Virtual Test Vault for testing without USB drive
    document.getElementById('curtain-btn-virtual-test')?.addEventListener('click', async () => {
      const btn = document.getElementById('curtain-btn-virtual-test');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Mounting Virtual Vault...';
      }
      try {
        const res = await API.invoke('vault:mountVirtual');
        if (res && res.success) {
          this._applyVaultState(res.state);
          await APP_STATE.initialize();
          this.render();
          if (typeof Toast !== 'undefined') Toast.show('Virtual Test Vault Mounted! Ready to test.', 'success');
        } else {
          alert('Could not mount virtual vault: ' + (res?.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Virtual mount error: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '⚡ Quick Test (Virtual Vault)';
        }
      }
    });

    // Curtain controls
    document.getElementById('curtain-btn-scan')?.addEventListener('click', async () => {
      try {
        const state = await API.invoke('vault:status');
        this._applyVaultState(state);
        await this._populateCurtainDrives();
        if (state && !state.isLocked) {
          if (typeof Toast !== 'undefined') Toast.show('Authorized Vault detected!', 'success');
        } else {
          if (typeof Toast !== 'undefined') Toast.show('No authorized vault found on attached drives.', 'info');
        }
      } catch (err) {
        console.error('Scan error:', err);
      }
    });

    document.getElementById('curtain-btn-toggle-pair')?.addEventListener('click', () => {
      const drawer = document.getElementById('curtain-pair-drawer');
      if (drawer) {
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
        if (drawer.style.display === 'block') {
          this._populateCurtainDrives();
        }
      }
    });

    document.getElementById('curtain-btn-init-confirm')?.addEventListener('click', async () => {
      const btn = document.getElementById('curtain-btn-init-confirm');
      const select = document.getElementById('curtain-select-drive');
      const targetDrive = select ? select.value : '';

      if (!targetDrive) {
        if (typeof Toast !== 'undefined') Toast.show('Please select a removable pen drive.', 'warning');
        else alert('Please select a removable drive to format as your Vault.');
        return;
      }

      if (!confirm(`Initialize new Hardware Security Key on ${targetDrive}?\n\nAll shop data, loans, and bills will be securely stored ONLY on this physical drive.`)) {
        return;
      }

      const origText = btn ? btn.innerHTML : 'Register / Initialize Drive';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Initializing Security Key...';
      }

      try {
        const res = await API.invoke('vault:init', { driveLetter: targetDrive, shopName: 'Jwellers Edith' });
        if (res && res.success) {
          this._applyVaultState(res.state);
          const curtain = document.getElementById('vault-lock-curtain');
          if (curtain) curtain.style.display = 'none';

          await APP_STATE.initialize();
          this.render();

          if (typeof Toast !== 'undefined') {
            Toast.show(`Security Key Registered on ${res.state.driveLetter}! Ready for setup.`, 'success');
          }
        } else {
          alert('Vault initialization failed: ' + (res?.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Error initializing drive: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = origText;
        }
      }
    });
  },

  async _populateCurtainDrives() {
    const select = document.getElementById('curtain-select-drive');
    if (!select) return;
    try {
      const drives = await API.invoke('vault:listDrives');
      if (Array.isArray(drives) && drives.length > 0) {
        select.innerHTML = '<option value="">-- Choose Removable Drive --</option>' +
          drives.map(d => `<option value="${d.driveLetter}">${d.driveLetter} (Removable Drive${d.hasVault ? ' - Vault exists' : ''})</option>`).join('');
      } else {
        select.innerHTML = '<option value="">No removable drives found (Insert Pen Drive)</option>';
      }
    } catch (_) {
      select.innerHTML = '<option value="">Insert USB Pen Drive...</option>';
    }
  },

  _initEmergencyHotkeys() {
    window.addEventListener('keydown', async (e) => {
      // 1. Double Escape for Emergency Panic Lock
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - this._lastEscTime < 400) {
          console.warn('[Hotkey] Panic Lock triggered via Double Escape');
          try {
            await API.invoke('vault:lock', { reason: 'Panic Lock via Double Escape' });
          } catch (_) {}
        }
        this._lastEscTime = now;
      }

      // 2. Ctrl + L for Instant Vault Lock
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        console.warn('[Hotkey] Lock triggered via Ctrl+L');
        try {
          await API.invoke('vault:lock', { reason: 'Lock triggered via Ctrl+L' });
        } catch (_) {}
      }
    });
  },

  render() {
    const screen = APP_STATE.get('screen');
    const appEl = document.getElementById('app');

    if (screen === 'login' || screen === 'createOwner') {
      appEl.innerHTML = AUTH_SCREEN.render();
      this._checkFirstTime();
    } else if (screen === 'setup') {
      appEl.innerHTML = SHOP_SETUP_SCREEN.render();
      SHOP_SETUP_SCREEN.init().catch(e => console.error('Setup init error:', e));
    } else if (screen === 'app') {
      appEl.innerHTML = DASHBOARD_SCREEN.render();
      DASHBOARD_SCREEN.init().catch(e => console.error('Dashboard init error:', e));
      this._bindLogout();
      this._bindVaultTopBarControls();
    } else {
      appEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    }

    if (this._vaultState) {
      this.updateHeaderVaultPill(this._vaultState);
    }
  },

  _bindVaultTopBarControls() {
    // Click on Storage status pill opens Backup & Storage Screen
    document.getElementById('vault-status-pill')?.addEventListener('click', () => {
      if (typeof DASHBOARD_SCREEN !== 'undefined' && DASHBOARD_SCREEN.navigate) {
        DASHBOARD_SCREEN.navigate('backup');
      }
    });

    // Lock button in topbar
    document.getElementById('btn-emergency-lock')?.addEventListener('click', async () => {
      try {
        await API.invoke('vault:lock', { reason: 'User clicked Lock Screen' });
      } catch (err) {
        console.error('Lock error:', err);
      }
    });
  },

  async _checkFirstTime() {
    try {
      const result = await API.invoke('admin:checkOwner');
      if (!result.hasOwner) {
        AUTH_SCREEN.showCreateOwner();
      } else {
        AUTH_SCREEN.showLogin();
      }
    } catch (err) {
      AUTH_SCREEN.showLogin();
    }
  },

  _bindLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      try {
        await API.invoke('auth:logout', { token: API.getToken() });
      } catch (e) { /* ignore */ }
      API.clearToken();
      APP_STATE.reset();
      this.render();
    });
  },

  _renderError(msg) {
    document.getElementById('app').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:40px">
        <div class="card" style="text-align:center;max-width:400px">
          <h2 style="margin-bottom:12px;color:var(--danger)">Startup Error</h2>
          <p style="color:var(--text-secondary);margin-bottom:20px">${this._escape(msg)}</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
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

document.addEventListener('DOMContentLoaded', () => APP.start());

window.APP = APP;
