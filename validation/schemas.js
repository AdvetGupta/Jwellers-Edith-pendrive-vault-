const VALID_BILL_TYPES = ['gst', 'non_gst'];
const VALID_PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'];
const VALID_PAYMENT_TYPES = ['bill_payment', 'khata_payment', 'opening_balance', 'refund', 'adjustment'];
const VALID_MOVEMENT_TYPES = ['opening_stock', 'purchase_added', 'sold', 'returned', 'repair', 'exchange', 'damaged', 'lost', 'manual_adjustment'];
const VALID_DATA_SOURCES = ['live', 'migrated'];
const VALID_BILL_STATUSES = ['active', 'cancelled', 'reversed'];
const VALID_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];
const VALID_COMM_TYPES = ['whatsapp', 'sms'];
const VALID_MESSAGE_TYPES = ['invoice', 'payment_confirmation', 'deposit_confirmation', 'khata_reminder', 'girvi_reminder', 'girvi_receipt', 'custom'];
const VALID_TRANSACTION_TYPES = ['bill', 'payment', 'opening_balance', 'adjustment_debit', 'adjustment_credit', 'refund', 'deposit'];
const VALID_CUSTOMER_SORT_COLUMNS = ['id', 'customer_id', 'name', 'phone1', 'city', 'created_at', 'updated_at'];
const VALID_PRODUCT_SORT_COLUMNS = ['id', 'product_name', 'category_id', 'selling_price', 'quantity_in_stock', 'created_at'];
const VALID_BILL_SORT_COLUMNS = ['id', 'invoice_number', 'bill_date', 'grand_total', 'payment_status', 'bill_type', 'created_at'];
const VALID_PAYMENT_SORT_COLUMNS = ['id', 'payment_date', 'amount', 'payment_method', 'type', 'created_at'];
const VALID_KHATA_SORT_COLUMNS = ['id', 'transaction_date', 'debit', 'credit', 'balance', 'transaction_type', 'created_at'];
const VALID_SUPPLIER_SORT_COLUMNS = ['id', 'name', 'city', 'created_at'];

const PHONE_REGEX = /^[+]?[\d\s\-()]{7,20}$/;
const NAME_REGEX = /^[a-zA-Z\s.'\-]+$/;
const CUSTOMER_ID_REGEX = /^[a-zA-Z0-9\-_]+$/;
const INVOICE_REGEX = /^[a-zA-Z0-9\-/]+$/;

module.exports = {
  VALID_BILL_TYPES, VALID_PAYMENT_METHODS, VALID_PAYMENT_TYPES, VALID_MOVEMENT_TYPES,
  VALID_DATA_SOURCES, VALID_BILL_STATUSES, VALID_PAYMENT_STATUSES, VALID_COMM_TYPES,
  VALID_MESSAGE_TYPES, VALID_TRANSACTION_TYPES,
  VALID_CUSTOMER_SORT_COLUMNS, VALID_PRODUCT_SORT_COLUMNS, VALID_BILL_SORT_COLUMNS,
  VALID_PAYMENT_SORT_COLUMNS, VALID_KHATA_SORT_COLUMNS, VALID_SUPPLIER_SORT_COLUMNS,
  PHONE_REGEX, NAME_REGEX, CUSTOMER_ID_REGEX, INVOICE_REGEX
};
