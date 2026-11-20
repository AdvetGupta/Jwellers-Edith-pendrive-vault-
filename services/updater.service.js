const https = require('https');
const { app } = require('electron');
const logger = require('../logging/logger');

const GITHUB_REPO = 'AdvetGupta/Jwellers-Edith-pendrive-vault-';

class UpdaterService {
  getCurrentVersion() {
    try {
      return (app && typeof app.getVersion === 'function') ? app.getVersion() : require('../package.json').version;
    } catch (_) {
      return '2.0.0';
    }
  }

  async checkForUpdates() {
    const currentVersion = this.getCurrentVersion();
    logger.info(`[Updater] Checking for updates against ${GITHUB_REPO}... (Current: v${currentVersion})`);

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'Jwellers-Edith-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(body);
              const latestTag = (release.tag_name || '').replace(/^v/, '');
              const hasUpdate = this._isNewerVersion(latestTag, currentVersion);

              const exeAsset = (release.assets || []).find(a => a.name.endsWith('.exe'));

              resolve({
                hasUpdate,
                currentVersion,
                latestVersion: latestTag || currentVersion,
                releaseName: release.name || release.tag_name,
                releaseNotes: release.body || 'Performance improvements and bug fixes.',
                downloadUrl: exeAsset ? exeAsset.browser_download_url : release.html_url,
                publishedAt: release.published_at
              });
            } catch (e) {
              resolve({ hasUpdate: false, currentVersion, error: e.message });
            }
          } else {
            resolve({ hasUpdate: false, currentVersion, status: res.statusCode });
          }
        });
      });

      req.on('error', (err) => {
        logger.warn(`[Updater] Offline or update check failed: ${err.message}`);
        resolve({ hasUpdate: false, currentVersion, offline: true });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ hasUpdate: false, currentVersion, timeout: true });
      });

      req.end();
    });
  }

  _isNewerVersion(latest, current) {
    if (!latest || !current) return false;
    const lParts = latest.split('.').map(n => parseInt(n, 10) || 0);
    const cParts = current.split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }
}

module.exports = new UpdaterService();
