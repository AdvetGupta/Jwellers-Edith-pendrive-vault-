const STAFF_SCREEN = {
  _staffList: [],
  _selectedStaff: null,

  render() {
    return `
      <div class="page-header">
        <h2>Staff Management</h2>
        <div class="page-header-actions">
          <input type="text" class="form-control" id="staff-search-input" placeholder="Search staff..." style="width:200px" autocomplete="off">
          <button class="btn btn-primary" id="staff-add-btn">+ Add Staff</button>
        </div>
      </div>
      <div id="staff-content">
        <div class="loading"><div class="spinner"></div></div>
      </div>
      <div id="staff-modal-container"></div>
    `;
  },

  async init() {
    await this._loadStaff();
    document.getElementById('staff-add-btn')?.addEventListener('click', () => this._showCreateModal());
    document.getElementById('staff-search-input')?.addEventListener('input', () => this._renderList());

    if (APP_STATE.hasPermission('staff.create')) {
      document.getElementById('staff-add-btn').style.display = '';
    } else {
      document.getElementById('staff-add-btn').style.display = 'none';
    }
  },

  async _loadStaff() {
    try {
      this._staffList = await API.invoke('staff:list');
      this._renderList();
    } catch (err) {
      document.getElementById('staff-content').innerHTML = `
        <div class="alert alert-error">Failed to load staff: ${err.message}</div>
      `;
    }
  },

  _renderList() {
    const container = document.getElementById('staff-content');
    if (!container) return;

    if (!this._staffList || this._staffList.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No staff accounts</h3><p>Click "Add Staff" to create the first staff account.</p></div>';
      return;
    }

    const searchTerm = (document.getElementById('staff-search-input')?.value || '').toLowerCase().trim();
    const filtered = searchTerm ? this._staffList.filter(s =>
      (s.display_name || '').toLowerCase().includes(searchTerm) ||
      (s.username || '').toLowerCase().includes(searchTerm) ||
      (s.role_name || '').toLowerCase().includes(searchTerm)
    ) : this._staffList;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No matching staff</h3><p>Try a different search term.</p></div>';
      return;
    }

    const canEdit = APP_STATE.hasPermission('staff.edit');
    const canDelete = APP_STATE.hasPermission('staff.delete');

    container.innerHTML = `
      <div class="staff-grid">
        ${filtered.map(s => this._renderCard(s, canEdit, canDelete)).join('')}
      </div>
    `;

    this._bindCardEvents();
  },

  _renderCard(staff, canEdit, canDelete) {
    const initial = staff.display_name ? staff.display_name.charAt(0).toUpperCase() : 'S';
    const isActive = !!staff.is_active;
    const lastLogin = staff.last_login_at ? new Date(staff.last_login_at).toLocaleDateString() : 'Never';

    return `
      <div class="staff-card" data-id="${staff.id}">
        <div class="staff-card-avatar">${initial}</div>
        <div class="staff-card-body">
          <h3>${this._escape(staff.display_name)}</h3>
          <p>@${this._escape(staff.username)} · <span class="badge badge-role">${this._escape(staff.role_name || 'staff')}</span> · ${isActive ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}</p>
          <p>Last login: ${lastLogin}</p>
          <div class="staff-card-actions">
            ${canEdit ? `<button class="btn btn-sm btn-secondary staff-edit-btn" data-id="${staff.id}">Edit</button>` : ''}
            ${canEdit ? `<button class="btn btn-sm btn-secondary staff-perm-btn" data-id="${staff.id}" data-name="${this._escape(staff.display_name)}">Permissions</button>` : ''}
            ${canEdit ? `<button class="btn btn-sm btn-secondary staff-reset-pw-btn" data-id="${staff.id}">Reset Password</button>` : ''}
            ${isActive ? (canDelete ? `<button class="btn btn-sm btn-danger staff-deactivate-btn" data-id="${staff.id}">Deactivate</button>` : '') :
                         (canEdit ? `<button class="btn btn-sm btn-success staff-reactivate-btn" data-id="${staff.id}">Reactivate</button>` : '')}
          </div>
        </div>
      </div>
    `;
  },

  _bindCardEvents() {
    document.querySelectorAll('.staff-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const staff = this._staffList.find(s => s.id === id);
        if (staff) this._showEditModal(staff);
      });
    });

    document.querySelectorAll('.staff-perm-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const name = btn.dataset.name;
        PERMISSIONS_SCREEN.show(id, name);
      });
    });

    document.querySelectorAll('.staff-reset-pw-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        this._showResetPasswordModal(id);
      });
    });

    document.querySelectorAll('.staff-deactivate-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        if (confirm('Are you sure you want to deactivate this staff member?')) {
          try {
            await API.invoke('staff:deactivate', { id });
            this._showToast('Staff deactivated', 'success');
            await this._loadStaff();
          } catch (err) {
            this._showToast(err.message, 'error');
          }
        }
      });
    });

    document.querySelectorAll('.staff-reactivate-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        try {
          await API.invoke('staff:reactivate', { id });
          this._showToast('Staff reactivated', 'success');
          await this._loadStaff();
        } catch (err) {
          this._showToast(err.message, 'error');
        }
      });
    });
  },

  _showCreateModal() {
    this._showFormModal('Create Staff Account', null);
  },

  _showEditModal(staff) {
    this._showFormModal('Edit Staff', staff);
  },

  _showFormModal(title, staff) {
    const isEdit = !!staff;
    const container = document.getElementById('staff-modal-container');

    container.innerHTML = `
      <div class="modal-overlay" id="staff-form-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close" id="staff-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="staff-form-alert"></div>
            <form id="staff-form" onsubmit="return false">
              <div class="form-group">
                <label for="staff-name">Name</label>
                <input type="text" id="staff-name" class="form-control" value="${isEdit ? this._escape(staff.display_name) : ''}" ${isEdit ? '' : 'autofocus'}>
              </div>
              <div class="form-group">
                <label for="staff-username">Username</label>
                <input type="text" id="staff-username" class="form-control" value="${isEdit ? this._escape(staff.username) : ''}">
              </div>
              ${isEdit ? '' : `
              <div class="form-group">
                <label for="staff-password">Password</label>
                <div class="password-wrapper">
                  <input type="password" id="staff-password" class="form-control" placeholder="At least 6 characters">
                  <button type="button" class="password-toggle" id="toggle-staff-pw" tabindex="-1">Show</button>
                </div>
              </div>
              <div class="form-group">
                <label for="staff-confirm">Confirm Password</label>
                <input type="password" id="staff-confirm" class="form-control" placeholder="Repeat password">
              </div>
              `}
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="staff-form-cancel">Cancel</button>
            <button class="btn btn-primary" id="staff-form-save">${isEdit ? 'Save Changes' : 'Create Staff'}</button>
          </div>
        </div>
      </div>
    `;

    const toggle = document.getElementById('toggle-staff-pw');
    const pw = document.getElementById('staff-password');
    if (toggle && pw) {
      toggle.addEventListener('click', () => {
        const isPw = pw.type === 'password';
        pw.type = isPw ? 'text' : 'password';
        toggle.textContent = isPw ? 'Hide' : 'Show';
      });
    }

    document.getElementById('staff-modal-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('staff-form-cancel').addEventListener('click', () => container.innerHTML = '');

    document.getElementById('staff-form-save').addEventListener('click', async () => {
      if (isEdit) {
        await this._saveEdit(staff.id);
      } else {
        await this._saveCreate();
      }
    });

    container.addEventListener('click', (e) => {
      if (e.target.id === 'staff-form-modal') container.innerHTML = '';
    });
  },

  async _saveCreate() {
    const name = document.getElementById('staff-name').value.trim();
    const username = document.getElementById('staff-username').value.trim();
    const password = document.getElementById('staff-password').value;
    const confirm = document.getElementById('staff-confirm').value;

    if (!name || !username || !password) {
      this._showFormError('Name, username, and password are required');
      return;
    }
    if (password.length < 6) {
      this._showFormError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      this._showFormError('Passwords do not match');
      return;
    }

    try {
      await API.invoke('staff:create', { displayName: name, username, password });
      document.getElementById('staff-modal-container').innerHTML = '';
      this._showToast('Staff account created', 'success');
      await this._loadStaff();
    } catch (err) {
      this._showFormError(err.message);
    }
  },

  async _saveEdit(id) {
    const name = document.getElementById('staff-name').value.trim();
    const username = document.getElementById('staff-username').value.trim();

    if (!name || !username) {
      this._showFormError('Name and username are required');
      return;
    }

    try {
      await API.invoke('staff:update', { id, displayName: name, username });
      document.getElementById('staff-modal-container').innerHTML = '';
      this._showToast('Staff updated', 'success');
      await this._loadStaff();
    } catch (err) {
      this._showFormError(err.message);
    }
  },

  _showResetPasswordModal(id) {
    const container = document.getElementById('staff-modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="reset-pw-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Reset Password</h2>
            <button class="modal-close" id="reset-pw-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="reset-pw-alert"></div>
            <form id="reset-pw-form" onsubmit="return false">
              <div class="form-group">
                <label for="reset-new-password">New Password</label>
                <div class="password-wrapper">
                  <input type="password" id="reset-new-password" class="form-control" placeholder="At least 6 characters" autofocus>
                  <button type="button" class="password-toggle" id="toggle-reset-pw" tabindex="-1">Show</button>
                </div>
              </div>
              <div class="form-group">
                <label for="reset-confirm">Confirm Password</label>
                <input type="password" id="reset-confirm" class="form-control" placeholder="Repeat password">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="reset-pw-cancel">Cancel</button>
            <button class="btn btn-primary" id="reset-pw-save">Reset Password</button>
          </div>
        </div>
      </div>
    `;

    const toggle = document.getElementById('toggle-reset-pw');
    const pw = document.getElementById('reset-new-password');
    if (toggle && pw) {
      toggle.addEventListener('click', () => {
        const isPw = pw.type === 'password';
        pw.type = isPw ? 'text' : 'password';
        toggle.textContent = isPw ? 'Hide' : 'Show';
      });
    }

    document.getElementById('reset-pw-close').addEventListener('click', () => container.innerHTML = '');
    document.getElementById('reset-pw-cancel').addEventListener('click', () => container.innerHTML = '');

    document.getElementById('reset-pw-save').addEventListener('click', async () => {
      const newPassword = document.getElementById('reset-new-password').value;
      const confirm = document.getElementById('reset-confirm').value;

      if (!newPassword || newPassword.length < 6) {
        document.getElementById('reset-pw-alert').innerHTML = '<div class="alert alert-error">Password must be at least 6 characters</div>';
        return;
      }
      if (newPassword !== confirm) {
        document.getElementById('reset-pw-alert').innerHTML = '<div class="alert alert-error">Passwords do not match</div>';
        return;
      }

      try {
        await API.invoke('staff:resetPassword', { id, newPassword });
        container.innerHTML = '';
        this._showToast('Password reset successfully', 'success');
      } catch (err) {
        document.getElementById('reset-pw-alert').innerHTML = `<div class="alert alert-error">${this._escape(err.message)}</div>`;
      }
    });

    container.addEventListener('click', (e) => {
      if (e.target.id === 'reset-pw-modal') container.innerHTML = '';
    });
  },

  _showFormError(msg) {
    const el = document.getElementById('staff-form-alert');
    if (el) el.innerHTML = `<div class="alert alert-error">${this._escape(msg)}</div>`;
  },

  _showToast(msg, type = 'info') {
    if (typeof Toast !== 'undefined') {
      Toast.show(msg, type);
    }
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.STAFF_SCREEN = STAFF_SCREEN;