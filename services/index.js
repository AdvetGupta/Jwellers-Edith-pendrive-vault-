const authService = require('./auth.service');
const staffService = require('./staff.service');
const customerService = require('./customer.service');
const settingsService = require('./settings.service');
const invoiceService = require('./invoice.service');
const khataService = require('./khata.service');
const permissionService = require('./permission.service');
const auditService = require('./audit.service');
const backupService = require('./backup.service');
const exportService = require('./export.service');

const membershipService = require('./membership.service');
const productService = require('./product.service');
const inventoryService = require('./inventory.service');
const categoryService = require('./category.service');
const productTypeService = require('./productType.service');
const paymentService = require('./payment.service');
const billService = require('./bill.service');
const reportService = require('./report.service');
const communicationService = require('./communication.service');

module.exports = {
  authService,
  staffService,
  customerService,
  settingsService,
  invoiceService,
  khataService,
  permissionService,
  auditService,
  backupService,
  exportService,
  membershipService,
  productService,
  inventoryService,
  categoryService,
  productTypeService,
  paymentService,
  billService,
  reportService,
  communicationService
};
