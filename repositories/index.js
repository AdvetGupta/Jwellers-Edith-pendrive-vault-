const userRepository = require('./user.repository');
const customerRepository = require('./customer.repository');
const productRepository = require('./product.repository');
const billRepository = require('./bill.repository');
const paymentRepository = require('./payment.repository');
const khataRepository = require('./khata.repository');
const inventoryRepository = require('./inventory.repository');
const { ShopSettingsRepository, AppSettingsRepository } = require('./settings.repository');

module.exports = {
  userRepository,
  customerRepository,
  productRepository,
  billRepository,
  paymentRepository,
  khataRepository,
  inventoryRepository,
  ShopSettingsRepository,
  AppSettingsRepository
};
