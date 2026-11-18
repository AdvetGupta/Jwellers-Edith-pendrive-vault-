const APP_STATE = {
  _state: {
    user: null,
    token: null,
    permissions: [],
    screen: 'loading'
  },
  _listeners: [],

  get(key) {
    return this._state[key];
  },

  set(key, value) {
    this._state[key] = value;
    this._notify(key, value);
  },

  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== callback);
    };
  },

  _notify(key, value) {
    for (const fn of this._listeners) {
      try { fn(key, value); } catch (e) { console.error('State listener error:', e); }
    }
  },

  isAuthenticated() {
    return !!this._state.token && !!this._state.user;
  },

  isOwner() {
    const roleName = this._state.user?.roleName;
    return roleName === 'owner';
  },

  hasPermission(code) {
    if (this.isOwner()) return true;
    return this._state.permissions.includes(code);
  },

  async loadPermissions() {
    try {
      const perms = await API.invoke('permission:getUserPermissions');
      this.set('permissions', perms || []);
    } catch (e) {
      console.error('Failed to load permissions:', e);
      this.set('permissions', []);
    }
  },

  async _applyTheme() {
    try {
      const savedTheme = localStorage.getItem('app_theme');
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        return;
      }
      const appSettings = await API.invoke('settings:getAppSettings');
      if (appSettings && appSettings.theme) {
        document.documentElement.setAttribute('data-theme', appSettings.theme);
        localStorage.setItem('app_theme', appSettings.theme);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (_) {
      const fallback = localStorage.getItem('app_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', fallback);
    }
  },

  async initialize() {
    const token = API.getToken();
    if (!token) {
      await this._applyTheme();
      this.set('screen', 'login');
      return;
    }

    try {
      await this._applyTheme();
      const user = await API.invoke('auth:getCurrentUser', { token });
      if (user) {
        this.set('token', token);
        this.set('user', user);
        await this.loadPermissions();
        await this._applyTheme();
        this.set('screen', 'app');
      } else {
        API.clearToken();
        this.set('screen', 'login');
      }
    } catch (e) {
      API.clearToken();
      this.set('screen', 'login');
    }
  },

  reset() {
    this._state.user = null;
    this._state.token = null;
    this._state.permissions = [];
    this._state.screen = 'login';
  }
};
