const API = {
  _token: localStorage.getItem('jwe_token') || null,
  _listeners: [],

  init() {
    this._token = localStorage.getItem('jwe_token') || null;
  },

  getToken() {
    return this._token;
  },

  setToken(token) {
    this._token = token;
    if (token) {
      localStorage.setItem('jwe_token', token);
    } else {
      localStorage.removeItem('jwe_token');
    }
  },

  clearToken() {
    this.setToken(null);
  },

  async invoke(channel, data = {}) {
    let payload;
    if (typeof data === 'string') {
      payload = { url: data, value: data, _token: this._token };
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      payload = { ...data, _token: this._token };
    } else {
      payload = { value: data, _token: this._token };
    }
    const result = await window.jwellersEdith.invoke(channel, payload);
    if (result && result.success === false) {
      const err = new Error(result.error.message);
      err.code = result.error.code;
      err.details = result.error.details;
      throw err;
    }
    return result && result.success !== undefined ? result.data : result;
  },

  on(channel, callback) {
    return window.jwellersEdith.on(channel, callback);
  }
};

API.init();
