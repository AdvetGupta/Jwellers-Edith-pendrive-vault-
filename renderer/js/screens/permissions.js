const PERMISSIONS_SCREEN = {
  _userId: null,
  _userName: '',
  _allPermissions: [],
  _userPermCodes: [],

  async show(userId, userName) {
    this._userId = userId;
    this._userName = userName;

    const container = document.getElementById('staff-modal-container') || document.getElementById('content-area');

    container.innerHTML = `
      <div class="modal-overlay" id="perms-modal">
        <div class="modal" style="max-width:680px">
          <div class="modal-header">
            <h2>Permissions — ${this._escape(userName)}</h2>
            <button class="modal-close" id="perms-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="perms-alert"></div>
            <div id="perms-content"><div class="loading"><div class="spinner"></div></div></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="perms-cancel">Close</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('perms-modal-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('perms-cancel').addEventListener('click', () => container.innerHTML = '');

    container.addEventListener('click', (e) => {
      if (e.target.id === 'perms-modal') container.innerHTML = '';
    });

    await this._loadPermissions();
  },

  async _loadPermissions() {
    try {
      const [allPerms, userPerms] = await Promise.all([
        API.invoke('permission:getAll'),
        API.invoke('permission:getUserPermissions')
      ]);

      this._allPermissions = allPerms || [];
      this._userPermCodes = userPerms || [];
      this._renderPermissions();
    } catch (err) {
      document.getElementById('perms-content').innerHTML = `<div class="alert alert-error">Failed to load permissions: ${this._escape(err.message)}</div>`;
    }
  },

  _renderPermissions() {
    const container = document.getElementById('perms-content');
    if (!container) return;

    const grouped = {};
    for (const perm of this._allPermissions) {
      const module = perm.module || 'Other';
      if (!grouped[module]) grouped[module] = [];
      grouped[module].push(perm);
    }

    const modules = Object.keys(grouped).sort();

    let html = '<p style="margin-bottom:16px;color:var(--text-secondary);font-size:13px">Assign additional permissions to this staff member beyond their role defaults.</p>';
    html += '<div class="permissions-grid">';

    for (const module of modules) {
      const perms = grouped[module];
      html += '<div class="permission-group"><h3>' + this._escape(module) + '</h3>';
      for (const perm of perms) {
        const checked = this._userPermCodes.includes(perm.code) ? 'checked' : '';
        html += `
          <div class="permission-item">
            <input type="checkbox" id="perm-${perm.id}" data-perm-id="${perm.id}" ${checked}>
            <label for="perm-${perm.id}">${this._escape(perm.name)}</label>
          </div>
        `;
      }
      html += '</div>';
    }

    html += '</div>';

    if (this._allPermissions.length === 0) {
      html = '<div class="alert alert-info">No permissions found in the system.</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', async () => {
        const permId = parseInt(cb.dataset.permId);
        const isGranted = cb.checked;

        try {
          await API.invoke('permission:setUserPermission', {
            userId: this._userId,
            permissionId: permId,
            isGranted
          });
          const msg = isGranted ? 'Permission granted' : 'Permission revoked';
          this._showPermToast(msg, 'success');

          if (isGranted) {
            const perm = this._allPermissions.find(p => p.id === permId);
            if (perm && !this._userPermCodes.includes(perm.code)) {
              this._userPermCodes.push(perm.code);
            }
          } else {
            const perm = this._allPermissions.find(p => p.id === permId);
            if (perm) {
              this._userPermCodes = this._userPermCodes.filter(c => c !== perm.code);
            }
          }
        } catch (err) {
          cb.checked = !isGranted;
          this._showPermToast(err.message, 'error');
        }
      });
    });
  },

  _showPermToast(msg, type) {
    const alert = document.getElementById('perms-alert');
    if (alert) {
      alert.innerHTML = `<div class="alert alert-${type === 'error' ? 'error' : 'success'}">${this._escape(msg)}</div>`;
      setTimeout(() => alert.innerHTML = '', 3000);
    }
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.PERMISSIONS_SCREEN = PERMISSIONS_SCREEN;