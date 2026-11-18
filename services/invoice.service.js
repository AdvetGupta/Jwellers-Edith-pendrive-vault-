const { ShopSettingsRepository } = require('../repositories');
const { billRepository } = require('../repositories');
const TransactionManager = require('../database/transaction_manager');
const { AppError } = require('../errors/app-error');

class InvoiceService {
  generateInvoiceNumber() {
    const settings = ShopSettingsRepository.get();
    const prefix = settings.invoice_prefix || 'INV-';
    const year = new Date().getFullYear().toString();
    const yearFormat = settings.invoice_year_format || 'YYYY';

    const yearStr = yearFormat.replace('YYYY', year).replace('YY', year.slice(-2));

    const nextNumber = settings.invoice_next_number || 1;

    return `${prefix}${yearStr}-${String(nextNumber).padStart(4, '0')}`;
  }

  reserveInvoiceNumber() {
    const settings = ShopSettingsRepository.get();
    const current = settings.invoice_next_number || 1;

    const invoiceNumber = this.generateInvoiceNumber();

    const existing = billRepository.findByInvoiceNumber(invoiceNumber);
    if (existing) {
      throw AppError.conflict(`Invoice number ${invoiceNumber} already exists. Contact support.`);
    }

    ShopSettingsRepository.update({
      invoice_next_number: current + 1,
      updated_at: new Date().toISOString()
    });

    return invoiceNumber;
  }
}

module.exports = new InvoiceService();
