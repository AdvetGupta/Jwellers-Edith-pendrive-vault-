const { AppError } = require('../errors/app-error');
const { sanitizeSearchTerm } = require('../utils/formatters');
const schemas = require('./schemas');

function validateId(value, name = 'id') {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1) {
    throw AppError.validation(`${name} must be a positive integer`);
  }
  return num;
}

function validateString(value, name = 'value', maxLength = 500) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
    throw AppError.validation(`${name} is required`);
  }
  const str = String(value).trim();
  if (str.length > maxLength) {
    throw AppError.validation(`${name} exceeds maximum length of ${maxLength}`);
  }
  return str;
}

function validateOptionalString(value, maxLength = 500) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (str.length > maxLength) return str.substring(0, maxLength);
  return str;
}

function validatePhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.length > 0 && !schemas.PHONE_REGEX.test(cleaned)) {
    throw AppError.validation('Invalid phone number format');
  }
  return cleaned;
}

function validateAmount(value, name = 'Amount') {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) {
    throw AppError.validation(`${name} must be a non-negative number`);
  }
  if (num > 999999999) {
    throw AppError.validation(`${name} exceeds maximum value`);
  }
  return Math.round(num * 100) / 100;
}

function validateWeight(value, name = 'Weight') {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) {
    throw AppError.validation(`${name} must be a non-negative number`);
  }
  return Math.round(num * 1000) / 1000;
}

function validateDate(dateStr, name = 'Date') {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw AppError.validation(`Invalid ${name} format`);
  }
  return d.toISOString().split('T')[0];
}

function validateEnum(value, allowedValues, name = 'Value') {
  if (!allowedValues.includes(value)) {
    throw AppError.validation(`${name} must be one of: ${allowedValues.join(', ')}`);
  }
  return value;
}

function validateOptionalEnum(value, allowedValues) {
  if (!value) return null;
  return validateEnum(value, allowedValues);
}

function validateSortColumn(column, allowedColumns) {
  if (!allowedColumns.includes(column)) {
    throw AppError.validation(`Invalid sort column: ${column}. Allowed: ${allowedColumns.join(', ')}`);
  }
  return column;
}

function validatePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 50));
  return { page, pageSize };
}

function validateSearch(term, name = 'Search term') {
  if (!term || term.trim().length === 0) return '';
  const sanitized = sanitizeSearchTerm(term.trim());
  if (sanitized.length > 100) {
    throw AppError.validation(`${name} is too long`);
  }
  return sanitized;
}

function validateCustomerId(customerId) {
  const str = validateString(customerId, 'Customer ID', 50);
  if (!schemas.CUSTOMER_ID_REGEX.test(str)) {
    throw AppError.validation('Customer ID can only contain letters, numbers, hyphens, and underscores');
  }
  return str;
}

function validateInvoiceNumber(invNumber) {
  const str = validateString(invNumber, 'Invoice number', 50);
  if (!schemas.INVOICE_REGEX.test(str)) {
    throw AppError.validation('Invoice number contains invalid characters');
  }
  return str;
}

function validateDiscount(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0 || num > 100) {
    throw AppError.validation('Discount percentage must be between 0 and 100');
  }
  return num;
}

function validatePercentage(value, name = 'Percentage') {
  if (value === null || value === undefined) return 0;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0 || num > 100) {
    throw AppError.validation(`${name} must be between 0 and 100`);
  }
  return num;
}

module.exports = {
  validateId, validateString, validateOptionalString, validatePhone, validateAmount,
  validateWeight, validateDate, validateEnum, validateOptionalEnum, validateSortColumn,
  validatePagination, validateSearch, validateCustomerId, validateInvoiceNumber,
  validateDiscount, validatePercentage, schemas
};
