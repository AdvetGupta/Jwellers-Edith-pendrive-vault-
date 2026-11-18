const { shell } = require('electron');

const handlers = [
  {
    channel: 'utils:echo',
    handler: async (event, data) => {
      return data;
    }
  },
  {
    channel: 'utils:openExternal',
    handler: async (event, data) => {
      let targetUrl = '';
      if (typeof data === 'string') {
        targetUrl = data;
      } else if (data && typeof data === 'object') {
        if (typeof data.url === 'string') {
          targetUrl = data.url;
        } else if (typeof data.value === 'string') {
          targetUrl = data.value;
        } else if (data['0'] !== undefined) {
          // Reassemble spread string characters: { '0': 'h', '1': 't', ... }
          const keys = Object.keys(data).filter(k => !isNaN(parseInt(k))).sort((a, b) => Number(a) - Number(b));
          targetUrl = keys.map(k => data[k]).join('');
        }
      }

      targetUrl = (targetUrl || '').trim();
      if (!targetUrl) {
        throw new Error('Invalid URL');
      }

      const allowedPrefixes = [
        'https://wa.me/',
        'https://api.whatsapp.com/',
        'https://web.whatsapp.com/',
        'whatsapp://'
      ];

      if (!allowedPrefixes.some(prefix => targetUrl.startsWith(prefix))) {
        throw new Error('Only WhatsApp URLs are allowed');
      }

      if (shell && typeof shell.openExternal === 'function') {
        await shell.openExternal(targetUrl);
      }
      return { opened: true, url: targetUrl };
    }
  }
];

module.exports = handlers;
