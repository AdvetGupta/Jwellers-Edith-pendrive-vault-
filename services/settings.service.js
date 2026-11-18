const { ShopSettingsRepository, AppSettingsRepository } = require('../repositories');
const { AppError } = require('../errors/app-error');
const { validateString, validateOptionalString, validatePhone, validateAmount } = require('../validation');
const audit = require('../logging/audit');

class SettingsService {
  getShopSettings() {
    const settings = ShopSettingsRepository.get();
    if (!settings) {
      ShopSettingsRepository.create({ id: 1 });
      return ShopSettingsRepository.get();
    }
    return settings;
  }

  updateShopSettings(data, userId) {
    const updates = {};

    if (data.shop_name !== undefined) updates.shop_name = validateOptionalString(data.shop_name, 200);
    if (data.owner_name !== undefined) updates.owner_name = validateOptionalString(data.owner_name, 200);
    if (data.address !== undefined) updates.address = validateOptionalString(data.address, 500);
    if (data.city !== undefined) updates.city = validateOptionalString(data.city, 100);
    if (data.phone !== undefined) updates.phone = validatePhone(data.phone);
    if (data.whatsapp_number !== undefined) updates.whatsapp_number = validatePhone(data.whatsapp_number);
    if (data.gst_number !== undefined) updates.gst_number = validateOptionalString(data.gst_number, 50);
    if (data.pan_number !== undefined) updates.pan_number = validateOptionalString(data.pan_number, 50);
    if (data.hallmark_registration !== undefined) updates.hallmark_registration = validateOptionalString(data.hallmark_registration, 100);
    if (data.currency !== undefined) updates.currency = data.currency;
    if (data.date_format !== undefined) updates.date_format = data.date_format;
    if (data.invoice_prefix !== undefined) updates.invoice_prefix = validateString(data.invoice_prefix, 'Invoice prefix', 10);
    if (data.invoice_next_number !== undefined) updates.invoice_next_number = parseInt(data.invoice_next_number, 10);
    if (data.default_gst_rate !== undefined) updates.default_gst_rate = validateAmount(data.default_gst_rate);
    if (data.enable_inventory !== undefined) updates.enable_inventory = data.enable_inventory ? 1 : 0;

    ShopSettingsRepository.update(updates);
    audit.log(userId, 'SETTINGS_UPDATED', 'settings', 1, 'Shop settings updated');

    return ShopSettingsRepository.get();
  }

  getAppSettings() {
    const settings = AppSettingsRepository.get();
    if (!settings) {
      AppSettingsRepository.create({ id: 1, schema_version: 1 });
      return AppSettingsRepository.get();
    }
    return settings;
  }

  updateAppSettings(data, userId) {
    const updates = {};
    if (data.theme !== undefined) updates.theme = data.theme;
    if (data.language !== undefined) updates.language = data.language;
    if (Object.keys(updates).length > 0) {
      AppSettingsRepository.updateSettings(updates);
    }

    // Handle drive_share_url separately via direct DB (column may not be in repository)
    if (data.drive_share_url !== undefined) {
      try {
        const { getDb } = require('../database/connection');
        const db = getDb();
        // Ensure column exists
        try {
          db.prepare("ALTER TABLE app_settings ADD COLUMN drive_share_url TEXT").run();
        } catch (_) { /* already exists */ }
        db.prepare("UPDATE app_settings SET drive_share_url = ? WHERE id = 1").run(data.drive_share_url || '');
      } catch (err) {
        console.warn('[SettingsService] Could not save drive_share_url:', err.message);
      }
    }

    audit.log(userId, 'APP_SETTINGS_UPDATED', 'app_settings', 1, 'App settings updated');
    return AppSettingsRepository.get();
  }

  isSetupComplete() {
    const settings = this.getShopSettings();
    return !!(settings.shop_name && settings.shop_name.trim());
  }

  completeSetup(data, userId) {
    return this.updateShopSettings(data, userId);
  }

  getInvoiceConfig() {
    const settings = this.getShopSettings();
    return {
      prefix: settings.invoice_prefix || 'INV-',
      nextNumber: settings.invoice_next_number || 1,
      yearFormat: settings.invoice_year_format || 'YYYY'
    };
  }
}

module.exports = new SettingsService();
