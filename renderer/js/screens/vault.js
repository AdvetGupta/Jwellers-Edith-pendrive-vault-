const VAULT_SCREEN = {
  _vaultState: null,
  _targetDrives: [],

  async render() {
    return `
      <div class="screen-container">
        <!-- Vault Header & Status Badge -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="font-size:24px;font-weight:700;color:var(--primary);margin-bottom:4px;display:flex;align-items:center;gap:10px;">
              <span>🛡️</span> Hardware Pen Drive Vault
            </h2>
            <p style="color:var(--text-secondary);font-size:13px;">
              Zero-PC Footprint Hardware Architecture — 100% Offline Security
            </p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="btn btn-outline" id="btn-refresh-vault-drives" style="font-weight:600;">
              🔄 Refresh Drives
            </button>
            <button class="btn btn-danger" id="btn-panic-lock-vault" style="font-weight:700;background:var(--danger);border-color:var(--danger);color:#fff;display:flex;align-items:center;gap:6px;">
              🔒 Instant Lock (Ctrl+L)
            </button>
          </div>
        </div>

        <!-- 3 Feature Highlights / Zero Footprint Guarantees -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;margin-bottom:24px;">
          <div class="card" style="padding:16px;border-left:4px solid #27ae60;background:var(--bg-card);">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#27ae60;margin-bottom:4px;">Zero PC Footprint</div>
            <div style="font-size:14px;color:var(--text);font-weight:600;">No records or bills on C: or D: drives</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">All financial records live strictly on the authorized Pen Drive.</div>
          </div>
          <div class="card" style="padding:16px;border-left:4px solid var(--primary);background:var(--bg-card);">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--primary);margin-bottom:4px;">100% Offline Mode</div>
            <div style="font-size:14px;color:var(--text);font-weight:600;">No Internet or Wi-Fi Required</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Billing, Girvi interest, and Khata run fully local and air-gapped.</div>
          </div>
          <div class="card" style="padding:16px;border-left:4px solid #e74c3c;background:var(--bg-card);">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#e74c3c;margin-bottom:4px;">Pull-to-Lock (&lt;100ms)</div>
            <div style="font-size:14px;color:var(--text);font-weight:600;">Instant Emergency Disconnect</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Unplugging the USB instantly locks screen and purges RAM.</div>
          </div>
        </div>

        <!-- Active Vault Status Card -->
        <div class="card" style="padding:24px;margin-bottom:24px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <h3 style="font-size:18px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;">
              <span id="vault-live-indicator" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#27ae60;"></span>
              Active Vault Status
            </h3>
            <span class="badge" id="vault-badge-status" style="background:rgba(39,174,96,0.15);color:#27ae60;font-weight:700;padding:6px 12px;border-radius:20px;font-size:12px;">
              🟢 Live & Mounted
            </span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:18px;" id="vault-metrics-grid">
            <div style="background:var(--bg-secondary);padding:14px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Mounted Drive</div>
              <div id="v-drive" style="font-size:18px;font-weight:700;color:var(--primary);margin-top:4px;">--</div>
            </div>
            <div style="background:var(--bg-secondary);padding:14px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Database Size</div>
              <div id="v-size" style="font-size:18px;font-weight:700;color:var(--text);margin-top:4px;">--</div>
            </div>
            <div style="background:var(--bg-secondary);padding:14px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Vault Signature ID</div>
              <div id="v-id" style="font-size:14px;font-weight:700;color:var(--text);margin-top:6px;word-break:break-all;">--</div>
            </div>
            <div style="background:var(--bg-secondary);padding:14px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Auto-Watcher</div>
              <div style="font-size:16px;font-weight:700;color:#27ae60;margin-top:4px;">100ms Heartbeat</div>
            </div>
          </div>

          <div style="font-size:12px;color:var(--text-secondary);background:var(--bg-secondary);padding:10px 14px;border-radius:6px;font-family:monospace;" id="v-path">
            Vault Path: --
          </div>
        </div>

        <!-- 1-Click Clone to 2nd Pen Drive -->
        <div class="card" style="padding:24px;margin-bottom:24px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <h3 style="font-size:18px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;">
                <span>💾</span> 1-Click "Clone to 2nd Pen Drive"
              </h3>
              <p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">
                Create a bit-for-bit verified clone of your vault on a secondary pen drive for off-site backup or portability.
              </p>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:240px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Select Target Pen Drive:</label>
              <select id="select-clone-target-drive" class="form-control" style="width:100%;height:40px;background:var(--bg-secondary);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0 10px;">
                <option value="">Scanning for attached drives...</option>
              </select>
            </div>
            <div style="align-self:flex-end;">
              <button class="btn btn-primary" id="btn-start-clone" style="height:40px;padding:0 20px;font-weight:700;display:flex;align-items:center;gap:8px;">
                <span>⚡</span> Clone Vault Now
              </button>
            </div>
          </div>

          <div id="clone-result-box" style="display:none;margin-top:16px;padding:14px;border-radius:6px;font-size:13px;"></div>
        </div>

        <!-- Format / Initialize a New Pen Drive -->
        <div class="card" style="padding:24px;margin-bottom:24px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <h3 style="font-size:18px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;">
                <span>🔑</span> Initialize / Pair a New Pen Drive
              </h3>
              <p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">
                Format a fresh USB drive with a new cryptographic signature and all 29 normalized database schemas.
              </p>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap;">
            <div style="width:200px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Target Drive:</label>
              <select id="select-init-target-drive" class="form-control" style="width:100%;height:40px;background:var(--bg-secondary);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0 10px;">
                <option value="">Select Drive</option>
              </select>
            </div>
            <div style="flex:1;min-width:200px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">Shop Name:</label>
              <input type="text" id="init-shop-name" class="form-control" value="Jwellers Edith" style="width:100%;height:40px;background:var(--bg-secondary);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0 10px;">
            </div>
            <div style="align-self:flex-end;">
              <button class="btn btn-outline" id="btn-init-new-vault" style="height:40px;padding:0 20px;font-weight:700;">
                Format & Create Vault
              </button>
            </div>
          </div>
        </div>

        <!-- RAM-Only Operational Logs (Zero PC Footprint) -->
        <div class="card" style="padding:24px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:16px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;">
              <span>📋</span> In-Memory Operational Logs (Volatile RAM)
            </h3>
            <button class="btn btn-xs btn-outline" id="btn-refresh-logs" style="font-size:11px;">Refresh Logs</button>
          </div>
          <div id="vault-logs-console" style="background:#050608;color:#7ec88b;font-family:Consolas, monospace;font-size:11px;padding:12px;border-radius:6px;height:160px;overflow-y:auto;white-space:pre-wrap;line-height:1.4;">
            Loading in-memory logs...
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.refreshStatus();
    await this.refreshDrives();
    await this.refreshLogs();

    document.getElementById('btn-refresh-vault-drives')?.addEventListener('click', async () => {
      await this.refreshDrives();
      await this.refreshStatus();
      if (typeof Toast !== 'undefined') Toast.show('Drives refreshed', 'info');
    });

    document.getElementById('btn-panic-lock-vault')?.addEventListener('click', async () => {
      try {
        await API.invoke('vault:lock', { reason: 'User initiated emergency lock' });
      } catch (err) {
        console.error('Lock error:', err);
      }
    });

    document.getElementById('btn-start-clone')?.addEventListener('click', async () => {
      await this.handleClone();
    });

    document.getElementById('btn-init-new-vault')?.addEventListener('click', async () => {
      await this.handleInitVault();
    });

    document.getElementById('btn-refresh-logs')?.addEventListener('click', async () => {
      await this.refreshLogs();
    });
  },

  async refreshStatus() {
    try {
      const state = await API.invoke('vault:status');
      this._vaultState = state;

      const driveEl = document.getElementById('v-drive');
      const sizeEl = document.getElementById('v-size');
      const idEl = document.getElementById('v-id');
      const pathEl = document.getElementById('v-path');
      const badgeEl = document.getElementById('vault-badge-status');
      const indicatorEl = document.getElementById('vault-live-indicator');

      if (state && !state.isLocked && state.driveLetter) {
        if (driveEl) driveEl.textContent = state.driveLetter;
        if (sizeEl) sizeEl.textContent = state.dbSizeFormatted || 'Ready';
        if (idEl) idEl.textContent = state.vaultId || 'Hardware Signature Verified';
        if (pathEl) pathEl.textContent = `Vault Path: ${state.vaultDir || state.driveLetter + ':\\.jwellers_vault'}`;
        if (badgeEl) {
          badgeEl.style.background = 'rgba(39,174,96,0.15)';
          badgeEl.style.color = '#27ae60';
          badgeEl.textContent = `🟢 Live on ${state.driveLetter}`;
        }
        if (indicatorEl) indicatorEl.style.background = '#27ae60';
      } else {
        if (driveEl) driveEl.textContent = 'None';
        if (sizeEl) sizeEl.textContent = 'Locked';
        if (idEl) idEl.textContent = 'No Hardware Signature';
        if (pathEl) pathEl.textContent = 'Vault Path: Disconnected';
        if (badgeEl) {
          badgeEl.style.background = 'rgba(231,76,60,0.15)';
          badgeEl.style.color = '#e74c3c';
          badgeEl.textContent = '🔴 Disconnected';
        }
        if (indicatorEl) indicatorEl.style.background = '#e74c3c';
      }
    } catch (err) {
      console.error('Failed to get vault status:', err);
    }
  },

  async refreshDrives() {
    try {
      const drives = await API.invoke('vault:listDrives');
      this._targetDrives = drives || [];

      const cloneSelect = document.getElementById('select-clone-target-drive');
      const initSelect = document.getElementById('select-init-target-drive');

      if (cloneSelect) {
        cloneSelect.innerHTML = '';
        const nonActive = this._targetDrives.filter(d => !d.isActive);
        if (nonActive.length === 0) {
          cloneSelect.innerHTML = '<option value="">No secondary removable drive found (Insert 2nd Pen Drive)</option>';
        } else {
          cloneSelect.innerHTML = '<option value="">-- Choose Target Pen Drive --</option>' +
            nonActive.map(d => `<option value="${d.driveLetter}">${d.driveLetter} (Removable Pen Drive${d.hasVault ? ' - Existing Vault' : ''})</option>`).join('');
        }
      }

      if (initSelect) {
        initSelect.innerHTML = '<option value="">-- Choose Drive --</option>' +
          this._targetDrives.map(d => `<option value="${d.driveLetter}">${d.driveLetter} (${d.isActive ? 'Active Vault' : 'Removable'})</option>`).join('');
      }
    } catch (err) {
      console.error('Failed to list target drives:', err);
    }
  },

  async handleClone() {
    const select = document.getElementById('select-clone-target-drive');
    const resultBox = document.getElementById('clone-result-box');
    const targetDrive = select ? select.value : '';

    if (!targetDrive) {
      if (typeof Toast !== 'undefined') Toast.show('Please select a target pen drive to clone to.', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to clone the entire live vault to drive ${targetDrive}? This will write the vault database and security signature to ${targetDrive}.`)) {
      return;
    }

    const btn = document.getElementById('btn-start-clone');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Cloning in progress...';
    }

    try {
      const res = await API.invoke('vault:clone', { targetDrive });
      if (res && res.success) {
        if (resultBox) {
          resultBox.style.display = 'block';
          resultBox.style.background = 'rgba(39,174,96,0.12)';
          resultBox.style.border = '1px solid #27ae60';
          resultBox.style.color = '#27ae60';
          resultBox.innerHTML = `
            <strong>✅ Vault Cloned Successfully to ${res.result.targetDrive}!</strong><br>
            <span style="font-size:11px;font-family:monospace;">SHA256 Integrity Hash: ${res.result.sha256}</span><br>
            <span style="font-size:12px;">This secondary pen drive can now be used as an authorized offline hardware vault on any PC.</span>
          `;
        }
        if (typeof Toast !== 'undefined') Toast.show(`Cloned successfully to ${targetDrive}!`, 'success');
        await this.refreshDrives();
      } else {
        throw new Error(res?.error || 'Clone operation failed');
      }
    } catch (err) {
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(231,76,60,0.12)';
        resultBox.style.border = '1px solid #e74c3c';
        resultBox.style.color = '#e74c3c';
        resultBox.innerHTML = `<strong>❌ Clone Failed:</strong> ${err.message}`;
      }
      if (typeof Toast !== 'undefined') Toast.show(err.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡</span> Clone Vault Now';
      }
    }
  },

  async handleInitVault() {
    const select = document.getElementById('select-init-target-drive');
    const shopInput = document.getElementById('init-shop-name');
    const targetDrive = select ? select.value : '';
    const shopName = shopInput ? shopInput.value : 'Jwellers Edith';

    if (!targetDrive) {
      if (typeof Toast !== 'undefined') Toast.show('Please select a drive to initialize as a new vault.', 'warning');
      return;
    }

    if (!confirm(`Initialize a new hardware vault on drive ${targetDrive}? This will create .jwellers_vault on ${targetDrive}.`)) {
      return;
    }

    try {
      const res = await API.invoke('vault:init', { driveLetter: targetDrive, shopName });
      if (res && res.success) {
        if (typeof Toast !== 'undefined') Toast.show(`New Hardware Vault initialized on ${targetDrive}!`, 'success');
        await this.refreshStatus();
        await this.refreshDrives();
      } else {
        throw new Error(res?.error || 'Initialization failed');
      }
    } catch (err) {
      if (typeof Toast !== 'undefined') Toast.show(err.message, 'danger');
    }
  },

  async refreshLogs() {
    const consoleEl = document.getElementById('vault-logs-console');
    if (!consoleEl) return;
    try {
      const logs = await API.invoke('vault:logs');
      if (Array.isArray(logs) && logs.length > 0) {
        consoleEl.textContent = logs.slice(-30).join('\n');
        consoleEl.scrollTop = consoleEl.scrollHeight;
      } else {
        consoleEl.textContent = 'No log entries yet. Memory is clean.';
      }
    } catch (_) {
      consoleEl.textContent = 'Could not retrieve RAM logs.';
    }
  }
};
