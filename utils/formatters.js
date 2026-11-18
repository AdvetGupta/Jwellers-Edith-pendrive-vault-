function formatCurrency(amount, currency = '₹') {
  if (amount === null || amount === undefined) return `${currency}0.00`;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${currency}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWeight(grams, decimals = 3) {
  if (grams === null || grams === undefined) return '0.000';
  const num = typeof grams === 'string' ? parseFloat(grams) : grams;
  return num.toFixed(decimals);
}

function formatDate(dateStr, format = 'DD/MM/YYYY') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  switch (format) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    case 'DD/MM/YYYY':
    default: return `${dd}/${mm}/${yyyy}`;
  }
}

function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '0') {
    return `0 ${cleaned.slice(1, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

function generateCustomerId(nextNumber) {
  return `CUST-${String(nextNumber).padStart(4, '0')}`;
}

function sanitizeSearchTerm(term) {
  if (!term) return '';
  return term.replace(/'/g, '').replace(/[%_\\]/g, '\\$&');
}

module.exports = { formatCurrency, formatWeight, formatDate, formatPhone, generateCustomerId, sanitizeSearchTerm };
