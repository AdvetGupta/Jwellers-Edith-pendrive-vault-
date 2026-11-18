const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { open, close, getDb } = require('../database/connection');
const { initialize } = require('../database/init');
const communicationService = require('../services/communication.service');
const customerRepository = require('../repositories/customer.repository');

async function runCommunicationTestSuite() {
  console.log('--- Starting Communication & WhatsApp Dues Sender Test Suite ---');
  const testDbPath = path.join(__dirname, 'test_communication.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  await open(testDbPath);
  await initialize();

  console.log('1. Creating test customer with 10-digit phone number...');
  const customer = customerRepository.create({
    customer_id: 'CUST-TEST-01',
    name: 'Suresh Agarwal',
    phone1: '9876543210',
    city: 'Mumbai',
    address: 'Zaveri Bazaar'
  });
  const createdCustomer = customerRepository.findById(customer.id);
  assert.strictEqual(createdCustomer.name, 'Suresh Agarwal');

  console.log('2. Testing WhatsApp Khata Dues Reminder Generation...');
  const result = communicationService.send(1, {
    customer_id: createdCustomer.id,
    communication_type: 'whatsapp',
    message_type: 'khata_reminder',
    balance_amount: 15450
  });

  console.log('Communication result:', result);
  assert.strictEqual(result.success, true, 'Result should be successful');
  assert.strictEqual(result.type, 'whatsapp');
  assert.ok(result.whatsappUrl.includes('919876543210'), 'WhatsApp URL should contain prepended country code 919876543210');
  assert.ok(result.whatsappUrl.includes('15%2C450') || result.whatsappUrl.includes('15450'), 'WhatsApp URL should contain balance amount');

  console.log('3. Testing 11-digit Phone (with leading 0)...');
  const customer2 = customerRepository.create({
    customer_id: 'CUST-TEST-02',
    name: 'Ramesh Patel',
    phone1: '09123456789',
    city: 'Ahmedabad'
  });

  const result2 = communicationService.send(1, {
    customer_id: customer2.id,
    communication_type: 'whatsapp',
    message_type: 'khata_reminder',
    balance_amount: 8200
  });
  console.log('11-digit WhatsApp result URL:', result2.whatsappUrl);
  assert.ok(result2.whatsappUrl.includes('919123456789'), 'Should sanitize leading 0 and format to 919123456789');

  console.log('4. Verifying Communication Logs Persistence...');
  const logs = communicationService.getHistory(createdCustomer.id);
  console.log('Logged history count:', logs.length);
  assert.strictEqual(logs.length, 1, 'Should log 1 communication attempt');
  assert.strictEqual(logs[0].communication_type, 'whatsapp');
  assert.strictEqual(logs[0].message_type, 'khata_reminder');

  close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  console.log('--- ✅ All Communication & WhatsApp Dues Tests Passed Successfully! ---');
}

runCommunicationTestSuite().catch(err => {
  console.error('❌ Communication Test Failed:', err);
  process.exit(1);
});
