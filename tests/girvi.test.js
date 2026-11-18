const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { open, close, getDb } = require('../database/connection');
const { initialize } = require('../database/init');
const girviRepository = require('../repositories/girvi.repository');
const girviService = require('../services/girvi.service');
const { parseCSVContent } = require('../utils/girvi_importer');

async function runGirviTestSuite() {
  console.log('--- Starting Girvi Module Test Suite ---');
  const testDbPath = path.join(__dirname, 'test_girvi_module.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  await open(testDbPath);
  await initialize();
  const db = getDb();

  console.log('1. Testing Girvi Loan Creation...');
  const newLoan = girviService.createLoan({
    customer_name: 'Rajesh Sharma',
    father_husband_name: 'Ramesh Sharma',
    caste: 'Brahmin',
    phone1: '9876543210',
    address: 'Rampur Village',
    loan_date: '2026-01-01',
    item_name: 'Gold Chain 22K',
    metal_type: 'gold',
    gold_weight: 15.500,
    silver_weight: 0.000,
    principal_amount: 50000,
    monthly_interest_percent: 2.0,
    locker_number: 'Locker A-1'
  });

  console.log(`Created Loan #${newLoan.loan_number} for ${newLoan.customer_name} (Caste: ${newLoan.caste})`);
  assert.ok(newLoan.id > 0, 'Loan ID should be valid');
  assert.strictEqual(newLoan.loan_number, 'GIR-0001', 'Loan number should be GIR-0001');
  assert.strictEqual(newLoan.principal_amount, 50000, 'Principal amount should be 50000');
  assert.strictEqual(newLoan.caste, 'Brahmin', 'Caste should be Brahmin');

  console.log('2. Testing Dues & Accumulated Interest Calculation...');
  const dues = girviService.calculateDues(newLoan, '2026-02-01'); // 31 days elapsed
  console.log('Dues output:', dues);
  assert.ok(dues.totalDays >= 31, 'Should calculate 31 elapsed days');
  assert.ok(dues.accumulatedInterest > 0, 'Interest should be greater than 0');
  assert.strictEqual(dues.currentPrincipal, 50000, 'Current principal should be 50000');

  console.log('3. Testing Girvi Entry Editing...');
  const updatedLoan = girviService.updateLoan(newLoan.id, {
    customer_name: 'Rajesh Kumar Sharma',
    caste: 'Sanatan Brahmin',
    gold_weight: 18.200,
    principal_amount: 55000,
    monthly_interest_percent: 2.5
  });
  console.log(`Updated Loan #${updatedLoan.loan_number}: ${updatedLoan.customer_name}, Caste: ${updatedLoan.caste}, Weight: ${updatedLoan.gold_weight}g`);
  assert.strictEqual(updatedLoan.customer_name, 'Rajesh Kumar Sharma');
  assert.strictEqual(updatedLoan.caste, 'Sanatan Brahmin');
  assert.strictEqual(updatedLoan.gold_weight, 18.2);
  assert.strictEqual(updatedLoan.principal_amount, 55000);

  console.log('4. Testing Recording Payments...');
  const paymentResult = girviService.recordPayment({
    girvi_loan_id: updatedLoan.id,
    transaction_date: '2026-02-05',
    amount: 5000,
    interest_component: 2000,
    principal_component: 3000,
    payment_method: 'upi'
  });
  console.log('Post-payment state:', paymentResult.dues);
  assert.strictEqual(paymentResult.dues.totalPrincipalPaid, 3000, 'Total principal paid should be 3000');
  assert.strictEqual(paymentResult.dues.currentPrincipal, 52000, 'Remaining principal should be 52000');

  console.log('4b. Testing Undo / Reversing Payments...');
  const payTxn = paymentResult.dues.transactions.find(t => t.transaction_type !== 'loan_disbursement');
  assert.ok(payTxn, 'Payment transaction should exist');
  const postUndoLoan = girviService.deletePayment(payTxn.id, updatedLoan.id);
  assert.strictEqual(postUndoLoan.dues.totalPrincipalPaid, 0, 'Total principal paid should be restored to 0');
  assert.strictEqual(postUndoLoan.dues.currentPrincipal, 55000, 'Remaining principal should be restored to 55000');
  assert.strictEqual(postUndoLoan.dues.lastInterestDate, '2026-01-01', 'lastInterestDate should restore to original loan date');
  console.log('Undo payment verified: Principal restored to ₹55,000 and base date restored to 2026-01-01');

  console.log('5. Testing Soft Delete Flexibility...');
  const secondLoan = girviService.createLoan({
    customer_name: 'Suresh Verma',
    caste: 'Verma',
    phone1: '9123456789',
    address: 'City Market',
    item_name: 'Silver Bangle',
    metal_type: 'silver',
    silver_weight: 120.000,
    principal_amount: 8000
  });
  assert.strictEqual(secondLoan.loan_number, 'GIR-0002');

  girviService.softDeleteLoan(secondLoan.id);
  const deletedFetch = girviService.getLoanById(secondLoan.id);
  assert.strictEqual(deletedFetch, null, 'Deleted loan should not be retrievable');

  console.log('6. Testing Hindi Excel / CSV Importer Parsing with Caste / जाति...');
  const sampleHindiCSV = `ग्राहक क्र.,ग्राहक का नाम,पिता/पति का नाम,जाति,गांव,मोबाईल नं.,आइटम का नाम,धातु,सोना (ग्राम),चांदी (ग्राम),रकम,ब्याज (%),गिरवी दिनांक
GIR-101,आनंद कुमार,रामचंद्र,माळी,इंदापुर,9898989898,सोना साखळी,gold,12.5,0,35000,2.0,15/01/2026
GIR-102,सुनीता देवी,विजय कुमार,मराठा,पुणे,9797979797,चांदी पैंजण,silver,0,250,12000,2.5,20/01/2026`;

  const importResult = parseCSVContent(sampleHindiCSV);
  console.log(`Parsed ${importResult.parsedRows.length} rows from Hindi CSV:`, importResult.parsedRows);
  assert.strictEqual(importResult.parsedRows.length, 2, 'Should parse 2 valid Hindi CSV rows');
  assert.strictEqual(importResult.parsedRows[0].customer_name, 'आनंद कुमार');
  assert.strictEqual(importResult.parsedRows[0].caste, 'माळी');
  assert.strictEqual(importResult.parsedRows[0].principal_amount, 35000);
  assert.strictEqual(importResult.parsedRows[1].customer_name, 'सुनीता देवी');
  assert.strictEqual(importResult.parsedRows[1].caste, 'मराठा');
  assert.strictEqual(importResult.parsedRows[1].metal_type, 'silver');

  console.log('7. Testing English Excel / CSV Importer with Caste & Currency symbols...');
  const sampleEnglishCSV = `Ticket No,Party Name,Relation,Caste,Village,Contact,Details,Gold (gm),Silver (gm),Principal Amount,Rate (%),Pledge Date
GIR-201,Rajesh Patel,Dattatray,Patidar,Baramati,9822112233,Gold Necklace 22K,25.400 gm,0,"₹75,000",2.0%,2026-02-10
GIR-202,Anita Sharma,Jagdish,Brahmin,Phaltan,9833445566,Silver Utensils,0,350 gm,"₹18,500",2.5%,12/02/2026`;

  const engResult = parseCSVContent(sampleEnglishCSV);
  console.log(`Parsed ${engResult.parsedRows.length} rows from English CSV:`, engResult.parsedRows);
  assert.strictEqual(engResult.parsedRows.length, 2, 'Should parse 2 valid English CSV rows');
  assert.strictEqual(engResult.parsedRows[0].customer_name, 'Rajesh Patel');
  assert.strictEqual(engResult.parsedRows[0].caste, 'Patidar');
  assert.strictEqual(engResult.parsedRows[0].gold_weight, 25.4);
  assert.strictEqual(engResult.parsedRows[0].principal_amount, 75000);
  assert.strictEqual(engResult.parsedRows[0].monthly_interest_percent, 2.0);
  assert.strictEqual(engResult.parsedRows[0].loan_date, '2026-02-10');
  assert.strictEqual(engResult.parsedRows[1].customer_name, 'Anita Sharma');
  assert.strictEqual(engResult.parsedRows[1].caste, 'Brahmin');
  assert.strictEqual(engResult.parsedRows[1].silver_weight, 350);
  assert.strictEqual(engResult.parsedRows[1].principal_amount, 18500);
  assert.strictEqual(engResult.parsedRows[1].monthly_interest_percent, 2.5);
  assert.strictEqual(engResult.parsedRows[1].loan_date, '2026-02-12');

  console.log('8. Testing Import Batch Undo and Redo Functionality...');
  // Create mock import batch
  const importedLoan1 = girviService.createLoan(engResult.parsedRows[0]);
  const importedLoan2 = girviService.createLoan(engResult.parsedRows[1]);
  girviService.recordImportBatch({
    batchId: 'batch_test_1',
    timestamp: new Date().toISOString(),
    totalRows: 2,
    successCount: 2,
    loanIds: [importedLoan1.id, importedLoan2.id]
  });

  const statusBefore = girviService.getImportStatus();
  assert.strictEqual(statusBefore.canUndo, true, 'Should have batch to undo');
  assert.strictEqual(statusBefore.canRedo, false, 'Should have no redo yet');

  // Test Undo
  const undoResult = girviService.undoLastImport();
  console.log('Undo Result:', undoResult);
  assert.strictEqual(undoResult.count, 2, 'Should undo 2 records');
  assert.strictEqual(girviService.getLoanById(importedLoan1.id), null, 'Undone loan 1 should be deleted');
  assert.strictEqual(girviService.getLoanById(importedLoan2.id), null, 'Undone loan 2 should be deleted');

  const statusAfterUndo = girviService.getImportStatus();
  assert.strictEqual(statusAfterUndo.canUndo, false, 'Undo stack should be empty');
  assert.strictEqual(statusAfterUndo.canRedo, true, 'Redo stack should have 1 batch');

  // Test Redo
  const redoResult = girviService.redoLastImport();
  console.log('Redo Result:', redoResult);
  assert.strictEqual(redoResult.count, 2, 'Should restore 2 records');
  assert.ok(girviService.getLoanById(importedLoan1.id) !== null, 'Restored loan 1 should exist');
  assert.ok(girviService.getLoanById(importedLoan2.id) !== null, 'Restored loan 2 should exist');

  console.log('9. Testing Girvi Search by Caste / Jaati...');
  const patidarSearch = girviService.search({ search: 'Patidar' });
  console.log(`Found ${patidarSearch.data.length} records searching 'Patidar':`, patidarSearch.data.map(d => d.customer_name + ' (' + d.caste + ')'));
  assert.strictEqual(patidarSearch.data.length, 1, 'Should find 1 record with caste Patidar');
  assert.strictEqual(patidarSearch.data[0].customer_name, 'Rajesh Patel');

  const brahminSearch = girviService.search({ search: 'Brahmin' });
  console.log(`Found ${brahminSearch.data.length} records searching 'Brahmin':`, brahminSearch.data.map(d => d.customer_name + ' (' + d.caste + ')'));
  assert.strictEqual(brahminSearch.data.length, 2, 'Should find 2 records with caste Brahmin');
  assert.strictEqual(brahminSearch.data[0].customer_name, 'Anita Sharma');

  console.log('10. Testing Month Calculation (15+ days = 1 month) & Automatic 1+ Year Compound Interest...');
  // Test 1: 3m 27d (117 days) -> remainder 27 >= 15 -> 4 billable months
  const loanShort = girviService.createLoan({
    customer_name: 'Tarun Shah',
    phone1: '9811000000',
    address: 'Pune',
    loan_date: '2026-01-01',
    item_name: 'Gold Ring',
    metal_type: 'gold',
    gold_weight: 10.0,
    principal_amount: 100000,
    monthly_interest_percent: 2.0
  });
  const duesShort = girviService.calculateDues(loanShort, '2026-04-28'); // 117 days = 3m 27d -> 4 months
  console.log('Short dues (3m 27d @ 2%/mo on ₹1,00,000):', duesShort);
  assert.strictEqual(duesShort.durationFormatted, '3m 27d');
  assert.strictEqual(duesShort.billableMonths, 4, '27 days >= 15 should count as 4 billable months');
  assert.strictEqual(duesShort.accumulatedInterest, 8000, '4 months * 2% of 100000 = 8000');
  assert.strictEqual(duesShort.compoundInterestValue, 0, 'Should be 0 for < 1 year');

  // Test 2: 14m 5d (425 days) -> remainder 5 < 15 -> 14 billable months (1 year + 2 months)
  const compoundLoan = girviService.createLoan({
    customer_name: 'Vikram Seth',
    caste: 'Jain',
    phone1: '9811223344',
    address: 'Pune City',
    loan_date: '2026-01-01',
    item_name: 'Gold Biscuits (2)',
    metal_type: 'gold',
    gold_weight: 50.0,
    principal_amount: 100000,
    monthly_interest_percent: 2.0
  });

  const compoundDues = girviService.calculateDues(compoundLoan, '2027-03-02'); // 425 days = 14m 5d -> 14 months
  console.log('Compound Interest dues (14m 5d @ 2%/mo on ₹1,00,000):', compoundDues);
  assert.strictEqual(compoundDues.interestType, 'compound');
  assert.strictEqual(compoundDues.durationFormatted, '14m 5d');
  assert.strictEqual(compoundDues.billableMonths, 14, '5 days < 15 should count as 14 billable months');
  // Year 1 (12 months): 24000 (Principal becomes 124000)
  // Remainder 2 months @ 2% of 124000: 4960
  // Total Interest: 28960
  assert.strictEqual(compoundDues.accumulatedInterest, 28960, 'Should accurately calculate 28960 compound interest');
  assert.strictEqual(compoundDues.compoundExtra, 960, 'Extra compound interest over simple interest should be 960');

  // Test CSV import with Hindi "चक्रवर्ती ब्याज" column
  const compoundCsv = `ग्राहक नाम,फोन,गांव,रकम,व्याज दर (%),ब्याज प्रकार,आइटम,सोना ग्राम
मुकेश जैन,9877001122,इंदापूर,50000,2.5,चक्रवर्ती ब्याज,सोना ब्रेसलेट,20`;
  const parsedCompoundCsv = parseCSVContent(compoundCsv);
  assert.strictEqual(parsedCompoundCsv.parsedRows[0].interest_type, 'compound', 'Should parse Hindi चक्रवर्ती ब्याज to compound');

  close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  console.log('--- ✅ All Girvi Module Tests Passed Successfully! ---');
}

runGirviTestSuite().catch(err => {
  console.error('❌ Girvi Test Failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
