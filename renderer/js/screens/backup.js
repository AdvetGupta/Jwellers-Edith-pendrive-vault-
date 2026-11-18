const BACKUP_SCREEN = {
  _backups: [],
  _selectedBackup: null,

  render() {
    return `
      <div class="backup-page">
        <!-- Primary Storage & Mirror Drive Section -->
        <div class="card" style="margin-bottom:24px;border:1px solid var(--border);background:var(--bg-card);padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <div>
              <h3 style="font-size:17px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                <span id="storage-status-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#27ae60;"></span>
                Primary Storage Drive & Mirror Copy
              </h3>
              <p style="font-size:12px;color:var(--text-secondary);margin:0;">
                Active working database drive and 1-click duplicate copy for secondary USB drives.
              </p>
            </div>
            <button class="btn btn-sm btn-outline" id="btn-refresh-storage-drives" style="font-weight:600;">
              🔄 Refresh Drives
            </button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;margin-bottom:16px;">
            <div style="background:var(--bg-secondary);padding:12px 14px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Active Storage Drive</div>
              <div id="storage-active-drive" style="font-size:16px;font-weight:700;color:var(--primary);margin-top:3px;">--</div>
            </div>
            <div style="background:var(--bg-secondary);padding:12px 14px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Database Size</div>
              <div id="storage-db-size" style="font-size:16px;font-weight:700;color:var(--text);margin-top:3px;">--</div>
            </div>
            <div style="background:var(--bg-secondary);padding:12px 14px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Status</div>
              <div id="storage-status-label" style="font-size:14px;font-weight:700;color:#27ae60;margin-top:4px;">🟢 Active & Connected</div>
            </div>
          </div>

          <!-- 1-Click Mirror Copy -->
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 14px;background:var(--bg-secondary);border-radius:8px;">
            <span style="font-size:13px;font-weight:600;color:var(--text);">Mirror Copy to 2nd Drive:</span>
            <select id="select-mirror-target-drive" style="min-width:220px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;">
              <option value="">Choose Target Drive...</option>
            </select>
            <button class="btn btn-sm btn-primary" id="btn-mirror-clone" style="font-weight:700;">
              💾 Create Mirror Copy
            </button>
          </div>
        </div>

        <div class="page-header">
          <h2>Database Snapshots</h2>
          <div class="page-header-actions">
            <button class="btn btn-primary" id="backup-create-btn">Create Snapshot</button>
            <button class="btn btn-secondary" id="backup-update-btn" disabled>Update Selected</button>
            <button class="btn btn-secondary" id="backup-restore-btn" disabled>Restore Selected</button>
          </div>
        </div>
        <div id="backup-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div id="backup-modal-container"></div>
      </div>
    `;
  },

  async init() {
    await this._load();
    await this._loadStorageInfo();

    document.getElementById('backup-create-btn')?.addEventListener('click', () => this._showCreateBackupDialog());
    document.getElementById('backup-update-btn')?.addEventListener('click', () => this._confirmUpdate());
    document.getElementById('backup-restore-btn')?.addEventListener('click', () => this._confirmRestore());
    document.getElementById('btn-refresh-storage-drives')?.addEventListener('click', async () => {
      await this._loadStorageInfo();
      if (typeof Toast !== 'undefined') Toast.show('Storage drives refreshed', 'info');
    });
    document.getElementById('btn-mirror-clone')?.addEventListener('click', async () => {
      await this._handleMirrorClone();
    });
  },

  async _loadStorageInfo() {
    try {
      const state = await API.invoke('vault:status');
      const drives = await API.invoke('vault:listDrives') || [];

      const activeEl = document.getElementById('storage-active-drive');
      const sizeEl = document.getElementById('storage-db-size');
      const labelEl = document.getElementById('storage-status-label');
      const dotEl = document.getElementById('storage-status-dot');
      const select = document.getElementById('select-mirror-target-drive');

      if (state && !state.isLocked && state.driveLetter) {
        if (activeEl) activeEl.textContent = `Drive ${state.driveLetter}`;
        if (sizeEl) sizeEl.textContent = state.dbSizeFormatted || 'Ready';
        if (labelEl) {
          labelEl.textContent = '🟢 Active & Connected';
          labelEl.style.color = '#27ae60';
        }
        if (dotEl) dotEl.style.background = '#27ae60';
      } else {
        if (activeEl) activeEl.textContent = 'None';
        if (sizeEl) sizeEl.textContent = 'Locked';
        if (labelEl) {
          labelEl.textContent = '🔴 Disconnected';
          labelEl.style.color = '#e74c3c';
        }
        if (dotEl) dotEl.style.background = '#e74c3c';
      }

      if (select) {
        const available = drives.filter(d => d.driveLetter !== state?.driveLetter);
        if (available.length > 0) {
          select.innerHTML = '<option value="">-- Select Target Pen Drive --</option>' +
            available.map(d => `<option value="${d.driveLetter}">${d.driveLetter} (${d.description || 'Removable Drive'}${d.hasVault ? ' - Has data' : ''})</option>`).join('');
        } else {
          select.innerHTML = '<option value="">No second drive detected (Insert 2nd USB)</option>';
        }
      }
    } catch (err) {
      console.warn('Storage info query notice:', err);
    }
  },

  async _handleMirrorClone() {
    const select = document.getElementById('select-mirror-target-drive');
    const targetDrive = select ? select.value : '';

    if (!targetDrive) {
      alert('Please choose a target USB drive to create the mirror copy.');
      return;
    }

    if (!confirm(`Create mirror copy of your shop database to ${targetDrive}? This will overwrite existing data on ${targetDrive}.`)) {
      return;
    }

    const btn = document.getElementById('btn-mirror-clone');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Copying...';
    }

    try {
      const res = await API.invoke('vault:clone', { targetDriveLetter: targetDrive });
      if (res && res.success) {
        if (typeof Toast !== 'undefined') {
          Toast.show(`Mirror copy successfully created on ${targetDrive}! (Verified)`, 'success');
        } else {
          alert(`Mirror copy successfully created on ${targetDrive}!`);
        }
        await this._loadStorageInfo();
      } else {
        alert('Mirror copy failed: ' + (res?.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Mirror copy error: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Create Mirror Copy';
      }
    }
  },

  async _load() {
    try {
      this._backups = await API.invoke('backup:list', { limit: 50 }) || [];
      this._renderList();
    } catch (err) {
      document.getElementById('backup-content').innerHTML = `
        <div class="alert alert-error">Failed to load backups: ${this._escape(err.message)}</div>`;
    }
  },

  _renderList() {
    const container = document.getElementById('backup-content');
    if (!container) return;

    if (!this._backups || this._backups.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No backups yet</h3>
          <p>Create your first backup to protect your business data.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="backup-list">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:30px"></th>
              <th>Date</th>
              <th>Type</th>
              <th>Location</th>
              <th>Size</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this._backups.map(b => this._renderBackupRow(b)).join('')}
          </tbody>
        </table>
      </div>`;

    this._bindRowEvents();
  },

  _renderBackupRow(b) {
    const date = b.created_at ? new Date(b.created_at + 'T00:00:00').toLocaleString() : '--';
    const selected = this._selectedBackup && this._selectedBackup.id === b.id;
    const location = b.backup_location || '--';
    const size = b.file_size ? this._formatSize(b.file_size) : '--';

    return `
      <tr class="backup-row ${selected ? 'backup-row-selected' : ''}" data-index="${b.id}">
        <td><input type="radio" name="backup-select" value="${b.id}" ${selected ? 'checked' : ''}></td>
        <td>${date}</td>
        <td><span class="badge badge-${b.backup_type === 'local' ? 'info' : 'warning'}">${this._escape(b.backup_type || 'local')}</span></td>
        <td class="text-muted" title="${this._escape(location)}">${this._escape(this._shortPath(location))}</td>
        <td>${size}</td>
        <td><span class="badge badge-${b.verification_status === 'verified' ? 'success' : 'warning'}">${this._escape(b.verification_status || 'unknown')}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary backup-verify-btn" data-id="${b.id}">Verify</button>
          <button class="btn btn-sm btn-danger backup-delete-btn" data-id="${b.id}">Delete</button>
        </td>
      </tr>`;
  },

  _bindRowEvents() {
    document.querySelectorAll('input[name="backup-select"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const id = parseInt(radio.value, 10);
        this._selectedBackup = this._backups.find(b => b.id === id) || null;
        const restoreBtn = document.getElementById('backup-restore-btn');
        const updateBtn = document.getElementById('backup-update-btn');
        if (restoreBtn) restoreBtn.disabled = !this._selectedBackup;
        if (updateBtn) updateBtn.disabled = !this._selectedBackup;
        this._renderList();
      });
    });

    document.querySelectorAll('.backup-verify-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const backup = this._backups.find(b => b.id === parseInt(btn.dataset.id));
        if (!backup || !backup.backup_location) {
          Toast.show('No backup file location available', 'error');
          return;
        }
        try {
          const result = await API.invoke('backup:verify', { backupPath: backup.backup_location });
          if (result && result.valid) {
            Toast.show('Backup verified — SHA-256: ' + (result.fileHash || '').slice(0, 16) + '...', 'success');
          } else {
            Toast.show('Backup invalid: ' + (result && result.error || 'Unknown'), 'error');
          }
        } catch (err) {
          Toast.show('Verification failed: ' + err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.backup-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        const backup = this._backups.find(b => b.id === id);
        if (!backup) return;
        
        const pathShort = this._shortPath(backup.backup_location || '');
        if (!confirm(`Are you sure you want to permanently delete backup "${pathShort}"?\nThis will delete the backup files from disk and remove it from history.`)) {
          return;
        }

        try {
          const result = await API.invoke('backup:delete', { id: backup.id, backupPath: backup.backup_location });
          if (result && result.success) {
            Toast.show('Backup deleted successfully', 'success');
            this._selectedBackup = null;
            const restoreBtn = document.getElementById('backup-restore-btn');
            const updateBtn = document.getElementById('backup-update-btn');
            if (restoreBtn) restoreBtn.disabled = true;
            if (updateBtn) updateBtn.disabled = true;
            await this._load();
          } else {
            Toast.show('Failed to delete: ' + (result.message || 'Unknown error'), 'error');
          }
        } catch (err) {
          Toast.show('Failed to delete: ' + err.message, 'error');
        }
      });
    });
  },

  _showCreateBackupDialog() {
    const container = document.getElementById('backup-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="backup-create-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Create Backup</h2>
            <button class="modal-close" id="backup-create-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="backup-create-alert"></div>
            <p>Choose where to save the backup:</p>
            <div class="form-group">
              <label for="backup-location">Backup Location</label>
              <input type="text" id="backup-location" class="form-control" placeholder="Default backup directory">
            </div>
            <p class="text-muted" style="font-size:13px;margin-top:8px">Leave empty to use the default backup directory.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="backup-create-cancel">Cancel</button>
            <button class="btn btn-primary" id="backup-create-confirm">Create Backup</button>
          </div>
        </div>
      </div>`;

    document.getElementById('backup-create-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('backup-create-cancel').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'backup-create-modal') container.innerHTML = ''; });
    document.getElementById('backup-create-confirm').addEventListener('click', async () => {
      const btn = document.getElementById('backup-create-confirm');
      btn.disabled = true;
      btn.textContent = 'Creating...';
      try {
        const backupDir = document.getElementById('backup-location').value.trim() || null;
        const result = await API.invoke('backup:create', { backupDir });
        container.innerHTML = '';
        Toast.success('Backup created: ' + (result.fileName || ''));
        await this._load();
      } catch (err) {
        document.getElementById('backup-create-alert').innerHTML =
          `<div class="alert alert-error">${this._escape(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create Backup';
      }
    });
  },

  _confirmRestore() {
    if (!this._selectedBackup) return;
    const container = document.getElementById('backup-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="restore-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Restore Backup</h2>
            <button class="modal-close" id="restore-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <strong>⚠ Warning!</strong> Restoring will replace all current data with the backup.
              This cannot be undone.
            </div>
            <p>Backup: <strong>${this._escape(this._selectedBackup.backup_location || '')}</strong></p>
            <p>Date: ${this._selectedBackup.created_at || 'Unknown'}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="restore-cancel">Cancel</button>
            <button class="btn btn-danger" id="restore-confirm">Restore Backup</button>
          </div>
        </div>
      </div>`;

    document.getElementById('restore-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('restore-cancel').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('restore-confirm').addEventListener('click', async () => {
      const btn = document.getElementById('restore-confirm');
      btn.disabled = true;
      btn.textContent = 'Restoring...';
      try {
        await API.invoke('backup:restore', { backupPath: this._selectedBackup.backup_location });
        container.innerHTML = '';
        Toast.success('Backup restored. Reloading...');
        setTimeout(() => location.reload(), 2000);
      } catch (err) {
        document.getElementById('restore-modal').querySelector('.modal-body').innerHTML +=
          `<div class="alert alert-error" style="margin-top:12px">${this._escape(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Restore Backup';
      }
    });
  },

  _confirmUpdate() {
    if (!this._selectedBackup) return;
    const container = document.getElementById('backup-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="update-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Update Backup</h2>
            <button class="modal-close" id="update-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <strong>⚠ Notice:</strong> This will overwrite the database file and Excel CSV spreadsheets inside this backup folder with your current live database data.
            </div>
            <p>Backup Folder: <strong>${this._escape(this._shortPath(this._selectedBackup.backup_location))}</strong></p>
            <p>Last Saved: ${this._selectedBackup.created_at || 'Unknown'}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="update-cancel">Cancel</button>
            <button class="btn btn-primary" id="update-confirm">Update Now</button>
          </div>
        </div>
      </div>`;

    document.getElementById('update-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('update-cancel').addEventListener('click', () => container.innerHTML = '');
    container.addEventListener('click', e => { if (e.target.id === 'update-modal') container.innerHTML = ''; });
    document.getElementById('update-confirm').addEventListener('click', async () => {
      const btn = document.getElementById('update-confirm');
      btn.disabled = true;
      btn.textContent = 'Updating...';
      try {
        await API.invoke('backup:update', { backupPath: this._selectedBackup.backup_location });
        container.innerHTML = '';
        Toast.show('Backup folder updated successfully!', 'success');
        await this._load();
      } catch (err) {
        document.getElementById('update-modal').querySelector('.modal-body').innerHTML +=
          `<div class="alert alert-error" style="margin-top:12px">${this._escape(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Update Now';
      }
    });
  },

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(1) + ' ' + units[i];
  },

  _shortPath(p) {
    if (!p) return '';
    const parts = p.replace(/\\/g, '/').split('/');
    if (parts.length <= 3) return p;
    return parts.slice(0, 2).join('/') + '/.../' + parts[parts.length - 1];
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.BACKUP_SCREEN = BACKUP_SCREEN;