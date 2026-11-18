const fs = require('fs');
const path = require('path');

// Comprehensive Hindi, Marathi & English column header alias dictionary
const HEADER_ALIASES = {
  loan_number: [
    'girvi_no', 'girvi no', 'ticket_no', 'ticket no', 'ticket_number', 'ticket number',
    'loan_no', 'loan no', 'loan_number', 'loan number', 'sr_no', 'sr no', 's.no', 's.no.', 'sr.no', 'sr.no.',
    'क्रमांक', 'क्र.', 'क्र', 'ग्राहक क्र.', 'गिरवी क्र.', 'ग्राहक नंबर', 'गिरवी नंबर', 'आइटम क्र.', 'आइटम नंबर', 'girvi_number', 'pawnticket'
  ],
  customer_name: [
    'customer_name', 'customer name', 'name', 'party_name', 'party name', 'customer', 'party', 'account_name', 'account name',
    'ग्राहक का नाम', 'ग्राहक नाम', 'नाम', 'खातेदार', 'पार्टीचे नाव', 'पार्टी नाव', 'ग्राहकाचे नाव'
  ],
  father_husband_name: [
    'father_husband_name', 'father_name', 'husband_name', 'father name', 'husband name',
    'relation', 'relation_name', 'relation name', 'care_of', 'c/o', 's/o', 'w/o', 'd/o',
    'पिता/पति का नाम', 'पिता का नाम', 'पति का नाम', 'वडिलांचे नाव'
  ],
  caste: [
    'caste', 'caste/jaati', 'caste / jaati', 'jaati', 'jati', 'cast', 'community',
    'जाति', 'जात', 'जाती', 'समाज', 'वर्ण'
  ],
  address: [
    'address', 'village', 'city', 'place', 'address/village', 'village/city', 'location', 'town',
    'ग्राहक का पता', 'पता', 'गांव', 'गाव', 'शहर', 'मु.', 'मुकाम', 'पत्ता', 'राहणार'
  ],
  phone1: [
    'phone1', 'phone', 'mobile', 'mobile_no', 'mobile no', 'contact', 'phone_number', 'cell', 'whatsapp',
    'मोबाईल नं.', 'मोबाइल', 'मोबाईल', 'संपर्क', 'फोन', 'फोन नंबर'
  ],
  loan_date: [
    'loan_date', 'loan date', 'date', 'girvi_date', 'girvi date', 'pledge_date', 'pledge date',
    'date of pledge', 'loan start date', 'गिरवी दिनांक', 'दिनांक', 'तारीख', 'दिनांक (तारीख)'
  ],
  item_name: [
    'item_name', 'item name', 'item', 'description', 'details', 'ornament', 'ornament_name',
    'ornament name', 'items', 'particulars', 'item details', 'asset',
    'आइटम का नाम', 'आइटम', 'सामान', 'वस्तु', 'दागिने', 'तपशील', 'दागिन्यांचा तपशील', 'जिन्स'
  ],
  metal_type: [
    'metal_type', 'metal type', 'metal', 'type', 'धातु', 'सोना/चांदी', 'gold/silver', 'धातू'
  ],
  gold_weight: [
    'gold_weight', 'gold weight', 'gold_wt', 'gold wt', 'gold', 'gold (gm)', 'gold (gms)',
    'gold (g)', 'gold wt (gm)', 'gold gm', 'gold net wt', 'gold gross wt',
    'सोना (ग्राम)', 'सोना', 'सोना ग्राम', 'सोने वजन', 'सोने (ग्रॅम)'
  ],
  silver_weight: [
    'silver_weight', 'silver weight', 'silver_wt', 'silver wt', 'silver', 'silver (gm)', 'silver (gms)',
    'silver (g)', 'silver wt (gm)', 'silver gm', 'silver net wt', 'silver gross wt',
    'चांदी (ग्राम)', 'चांदी', 'चांदी ग्राम', 'चांदी वजन', 'चांदी (ग्रॅम)'
  ],
  principal_amount: [
    'principal_amount', 'principal amount', 'principal', 'amount', 'loan_amount', 'loan amount',
    'principal (₹)', 'principal amount (₹)', 'amount (₹)', 'loan amount (₹)', 'principal (rs)', 'amount (rs)',
    'रकम', 'मूलधन', 'रकम (मूलधन)', 'राशि', 'मुद्दल', 'कर्ज रक्कम', 'रक्कम'
  ],
  monthly_interest_percent: [
    'monthly_interest_percent', 'monthly interest percent', 'interest_rate', 'interest rate',
    'rate (%)', 'rate %', 'rate', 'monthly rate (%)', 'interest (%)', 'interest', 'biyaj', 'int_rate', 'int rate',
    'ब्याज (%)', 'ब्याज दर', 'ब्याज', 'व्याज', 'व्याज दर (%)', 'दर'
  ],
  interest_type: [
    'interest_type', 'interest type', 'interest_method', 'interest method', 'byaj_type', 'byaj type', 'calculation_type',
    'ब्याज प्रकार', 'ब्याज का प्रकार', 'व्याज प्रकार', 'व्याज पद्धत', 'चक्रवृद्धि', 'कंपाउंड', 'compound', 'compound_interest',
    'simple_interest', 'साधारण ब्याज', 'चक्रवृद्धि ब्याज', 'चक्रवर्ती ब्याज', 'चक्रवर्ती', 'chakravarti', 'chakrvarti', 'chakravriddhi'
  ],
  reference_person: [
    'reference_person', 'reference person', 'reference', 'republic', 'witness', 'hawala', 'ref', 'guarantor',
    'रिपब्लिक', 'रेफरेंस', 'गवाह', 'हवाला', 'ओळख', 'मध्यस्थ', 'जामीनदार'
  ],
  locker_number: [
    'locker_number', 'locker number', 'locker', 'locker_no', 'locker no', 'locker_id', 'box', 'box_number',
    'लॉकर', 'लॉकर नंबर', 'लॉकर क्र.', 'खाना', 'खाना नं.'
  ],
  notes: [
    'notes', 'remark', 'remarks', 'note', 'comments', 'description_notes', 'memo',
    'नोट', 'रिमार्क', 'टिप्पणी', 'शेरा'
  ]
};

function normalizeHeader(header) {
  if (!header) return '';
  // Strip BOM, quotes, punctuation
  return String(header)
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[._\-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function matchHeaderToField(header) {
  const norm = normalizeHeader(header);
  if (!norm) return null;

  // Pass 1: Exact Match
  for (const [fieldName, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (norm === normalizeHeader(alias)) {
        return fieldName;
      }
    }
  }

  // Pass 2: Substring / token match (longest alias first)
  const allAliases = [];
  for (const [fieldName, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      allAliases.push({ fieldName, alias: normalizeHeader(alias) });
    }
  }
  allAliases.sort((a, b) => b.alias.length - a.alias.length);

  for (const item of allAliases) {
    if (norm.includes(item.alias)) {
      return item.fieldName;
    }
  }

  return null;
}

// Detect delimiter dynamically (comma, tab, semicolon, pipe)
function detectDelimiter(firstLine) {
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '|': (firstLine.match(/\|/g) || []).length
  };
  let best = ',';
  let max = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = delim;
    }
  }
  return best;
}

function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val)
    .replace(/₹|rs\.?|inr|,|%|\/mo|\/m|\/month/gi, '')
    .replace(/\b(gms?|grams?|g|kg|tola|t)\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return 0;
  const num = parseFloat(match[0]);
  return isNaN(num) ? 0 : num;
}

function cleanDate(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  const str = String(val).trim();

  // Excel serial date number (e.g. 44561)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utcDays = serial - 25569;
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      return dateInfo.toISOString().split('T')[0];
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = String(ddmmyyyy[1]).padStart(2, '0');
    const month = String(ddmmyyyy[2]).padStart(2, '0');
    let year = ddmmyyyy[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const yyyymmdd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = String(yyyymmdd[2]).padStart(2, '0');
    const day = String(yyyymmdd[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

function detectMetalType(row, itemText = '') {
  if (row.metal_type) {
    const m = String(row.metal_type).toLowerCase();
    if (m.includes('gold') || m.includes('सोना') || m.includes('सोने') || m.includes('au')) return 'gold';
    if (m.includes('silver') || m.includes('चांदी') || m.includes('ag')) return 'silver';
    if (m.includes('mix') || m.includes('मिक्स') || m.includes('both')) return 'mix';
  }

  const goldWt = cleanNumber(row.gold_weight);
  const silverWt = cleanNumber(row.silver_weight);

  if (goldWt > 0 && silverWt > 0) return 'mix';
  if (goldWt > 0) return 'gold';
  if (silverWt > 0) return 'silver';

  const text = (itemText + ' ' + (row.item_name || '')).toLowerCase();
  if (text.includes('gold') || text.includes('सोना') || text.includes('सोने') || text.includes('necklace') || text.includes('chain') || text.includes('ring') || text.includes('bangle')) return 'gold';
  if (text.includes('silver') || text.includes('चांदी') || text.includes('payal') || text.includes('पायल') || text.includes('utensils') || text.includes('bartan')) return 'silver';

  return 'gold';
}

function detectInterestType(val) {
  if (!val) return 'simple';
  const str = String(val).toLowerCase().trim();
  if (str.includes('compound') || str.includes('चक्रवृद्धि') || str.includes('चक्रवर्ती') || str.includes('chakr') || str.includes('कंपाउंड')) {
    return 'compound';
  }
  return 'simple';
}

function parseCSVContent(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('CSV file content is empty or invalid.');
  }

  // Strip BOM
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one record row.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCSVLine(lines[0], delimiter);
  const mapping = {};

  rawHeaders.forEach((header, index) => {
    const matchedField = matchHeaderToField(header);
    if (matchedField) {
      mapping[index] = matchedField;
    }
  });

  const parsedRows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length === 0 || cols.every(c => c === '')) continue;

    const row = {};
    cols.forEach((val, idx) => {
      const field = mapping[idx];
      if (field) {
        row[field] = val;
      }
    });

    const principal = cleanNumber(row.principal_amount);
    const custName = row.customer_name ? String(row.customer_name).trim() : '';

    if (custName || principal > 0 || row.phone1) {
      parsedRows.push({
        rawLineNumber: i + 1,
        loan_number: row.loan_number ? String(row.loan_number).trim() : null,
        customer_name: custName || `Customer #${i}`,
        father_husband_name: row.father_husband_name ? String(row.father_husband_name).trim() : null,
        caste: row.caste ? String(row.caste).trim() : null,
        phone1: row.phone1 ? String(row.phone1).replace(/\D/g, '') : '',
        address: row.address ? String(row.address).trim() : 'Local',
        loan_date: cleanDate(row.loan_date),
        item_name: row.item_name ? String(row.item_name).trim() : 'Jewellery Ornament',
        metal_type: detectMetalType(row, row.item_name),
        gold_weight: cleanNumber(row.gold_weight),
        silver_weight: cleanNumber(row.silver_weight),
        principal_amount: principal,
        monthly_interest_percent: cleanNumber(row.monthly_interest_percent) || 2.0,
        interest_type: detectInterestType(row.interest_type),
        locker_number: row.locker_number ? String(row.locker_number).trim() : null,
        reference_person: row.reference_person ? String(row.reference_person).trim() : null,
        notes: row.notes ? String(row.notes).trim() : null,
        data_source: 'imported'
      });
    }
  }

  return {
    rawHeaders,
    delimiter,
    mapping,
    parsedRows
  };
}

module.exports = {
  HEADER_ALIASES,
  matchHeaderToField,
  detectDelimiter,
  parseCSVLine,
  cleanNumber,
  cleanDate,
  detectMetalType,
  parseCSVContent
};
