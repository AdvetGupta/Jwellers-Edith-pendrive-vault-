const BaseRepository = require('./base_repository');

class ShopSettingsRepository extends BaseRepository {
  constructor() {
    super('shop_settings');
  }

  get() {
    return this.findById(1);
  }

  update(data) {
    const existing = this.get();
    if (!existing) {
      return this.create({ id: 1, ...data });
    }
    data.updated_at = new Date().toISOString();
    return super.update(1, data);
  }
}

class AppSettingsRepository extends BaseRepository {
  constructor() {
    super('app_settings');
  }

  get() {
    return this.findById(1);
  }

  updateSchemaVersion(version) {
    return this.update(1, { schema_version: version });
  }

  updateAppVersion(version) {
    return this.update(1, { app_version: version });
  }

  updateSettings(data) {
    return this.update(1, data);
  }
}

module.exports = { ShopSettingsRepository: new ShopSettingsRepository(), AppSettingsRepository: new AppSettingsRepository() };
