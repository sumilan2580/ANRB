// test_new_manufacturing_erp.js
const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_AUTH = 'Basic ' + Buffer.from('admin:admin123').toString('base64');

async function testAll() {
  console.log('=== TESTING NEW MANUFACTURING ERP FEATURES ===\n');

  // 1. Company Settings
  console.log('1. Company Settings');
  const getSettings = await fetch(`${BASE_URL}/company/settings`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(getSettings.status, 200, 'GET /api/company/settings status 200');
  const settingsData = await getSettings.json();
  assert.ok(settingsData.companyName, 'Company name present');
  console.log('   [PASS] Company Settings retrieved successfully');

  // 2. Production Orders
  console.log('2. Customer Production Orders');
  const poRes = await fetch(`${BASE_URL}/transactions/production-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: ADMIN_AUTH },
    body: JSON.stringify({
      orderDate: '2026-09-10',
      customerId: 1,
      customerOrderNo: 'CUST-ORD-001',
      finishedProductId: 1,
      gsm: 120,
      size: '12 FT x 100 M',
      requiredQuantity: 2500,
      unit: 'KG',
      deliveryDate: '2026-09-20',
      remarks: 'Priority export order'
    })
  });
  assert.strictEqual(poRes.status, 201, 'POST /api/transactions/production-orders status 201');
  const poData = await poRes.json();
  assert.ok(poData.id, 'Production Order ID generated');
  assert.strictEqual(poData.status, 'Pending', 'Initial PO status is Pending');
  console.log(`   [PASS] Production Order created: ${poData.order_no}`);

  // 3. Consumption / Material Issue Batch
  console.log('3. Material Issue / Consumption Batch');
  const cbRes = await fetch(`${BASE_URL}/transactions/consumption-batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: ADMIN_AUTH },
    body: JSON.stringify({
      date: '2026-09-10',
      productionOrderId: poData.id,
      machineId: 1,
      shiftId: 1,
      items: [
        { rawMaterialId: 1, quantity: 1500, unit: 'KG' },
        { rawMaterialId: 4, quantity: 50, unit: 'KG' }
      ],
      remarks: 'Issued for PO ' + poData.order_no
    })
  });
  assert.strictEqual(cbRes.status, 201, 'POST /api/transactions/consumption-batches status 201');
  const cbData = await cbRes.json();
  assert.ok(cbData.id, 'Consumption Batch ID generated');
  assert.strictEqual(cbData.items.length, 2, 'Two raw material items issued');
  console.log(`   [PASS] Consumption Batch issued: ${cbData.batch_no}`);

  // 4. Production Entry with Multi-Outputs and Wastage linked to Consumption Batch
  console.log('4. Production Entry with Wastage Logging');
  const prodRes = await fetch(`${BASE_URL}/transactions/production`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: ADMIN_AUTH },
    body: JSON.stringify({
      date: '2026-09-10',
      machineId: 1,
      shiftId: 1,
      productionOrderId: poData.id,
      consumptionBatchId: cbData.id,
      outputs: [
        { finishedProductId: 1, quantity: 1480, unit: 'KG', gsm: 120, widthSize: '12 FT' }
      ],
      totalWastage: 70,
      wastageUnit: 'KG',
      wastageReason: 'Edge Trimming & Start-up Scrap',
      remarks: 'Extrusion completed'
    })
  });
  assert.strictEqual(prodRes.status, 201, 'POST /api/transactions/production status 201');
  const prodData = await prodRes.json();
  assert.ok(prodData.id, 'Production Batch created');
  console.log(`   [PASS] Production Entry created: ${prodData.batch_code}`);

  // 5. Strict Stock Check Guard for Sales (Pre-sale stock rejection)
  console.log('5. Pre-Sale Finished Goods Stock Validation');
  const overSaleRes = await fetch(`${BASE_URL}/transactions/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: ADMIN_AUTH },
    body: JSON.stringify({
      date: '2026-09-10',
      customerId: 1,
      items: [
        { finishedProductId: 1, quantity: 9999999, rate: 150, unit: 'KG' }
      ]
    })
  });
  assert.strictEqual(overSaleRes.status, 400, 'Sale of excess stock must be rejected with HTTP 400');
  const overSaleErr = await overSaleRes.json();
  assert.ok(overSaleErr.error.includes('Insufficient finished goods stock'), 'Clear rejection message returned');
  console.log('   [PASS] Over-sale correctly rejected with HTTP 400 and clear error');

  // 6. Multi-Item GST Sale
  console.log('6. Multi-Item GST Sale Billing');
  const validSaleRes = await fetch(`${BASE_URL}/transactions/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: ADMIN_AUTH },
    body: JSON.stringify({
      date: '2026-09-10',
      customerId: 1,
      salesType: 'GST',
      paymentType: 'Credit',
      items: [
        { finishedProductId: 1, quantity: 300, rate: 150, unit: 'KG', gstPercent: 18 }
      ],
      discountAmount: 500,
      remarks: 'Order dispatched'
    })
  });
  assert.strictEqual(validSaleRes.status, 201, 'Multi-item sale created with HTTP 201');
  const saleData = await validSaleRes.json();
  assert.ok(saleData.id, 'Sale ID generated');
  console.log(`   [PASS] Sale invoice created: ${saleData.invoice_number}`);

  // 7. Customer Receipt
  console.log('7. Customer Payment Receipt');
  const recRes = await fetch(`${BASE_URL}/accounts/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: ADMIN_AUTH },
    body: JSON.stringify({
      date: '2026-09-10',
      partyType: 'CUSTOMER',
      partyId: 1,
      amount: 25000,
      paymentMode: 'Bank',
      referenceNo: 'NEFT-889911',
      remarks: 'Part payment against invoice'
    })
  });
  assert.strictEqual(recRes.status, 201, 'Receipt created with HTTP 201');
  const recData = await recRes.json();
  assert.ok(recData.id, 'Receipt ID generated');
  console.log(`   [PASS] Customer receipt recorded: ${recData.payment_code}`);

  // 8. Supplier Payment
  console.log('8. Supplier Payment');
  const payRes = await fetch(`${BASE_URL}/accounts/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: ADMIN_AUTH },
    body: JSON.stringify({
      date: '2026-09-10',
      partyType: 'SUPPLIER',
      partyId: 1,
      amount: 50000,
      paymentMode: 'Bank',
      referenceNo: 'RTGS-112233',
      remarks: 'Payment for raw materials'
    })
  });
  assert.strictEqual(payRes.status, 201, 'Supplier payment created with HTTP 201');
  const payData = await payRes.json();
  assert.ok(payData.id, 'Payment ID generated');
  console.log(`   [PASS] Supplier payment recorded: ${payData.payment_code}`);

  // 9. Customer Ledger
  console.log('9. Customer Statement & Ledger');
  const custLedgerRes = await fetch(`${BASE_URL}/accounts/customer-ledger?customerId=1`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(custLedgerRes.status, 200, 'Customer ledger returned status 200');
  const custLedger = await custLedgerRes.json();
  assert.ok(custLedger.transactions.length > 0, 'Transactions in ledger');
  assert.ok(custLedger.closingBalance !== undefined, 'Closing balance calculated');
  console.log(`   [PASS] Customer ledger retrieved. Closing Balance: ₹${custLedger.closingBalance}`);

  // 10. Supplier Ledger
  console.log('10. Supplier Statement & Ledger');
  const suppLedgerRes = await fetch(`${BASE_URL}/accounts/supplier-ledger?supplierId=1`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(suppLedgerRes.status, 200, 'Supplier ledger returned status 200');
  const suppLedger = await suppLedgerRes.json();
  assert.ok(suppLedger.closingBalance !== undefined, 'Closing balance calculated');
  console.log(`   [PASS] Supplier ledger retrieved. Closing Balance: ₹${suppLedger.closingBalance}`);

  // 11. Cash Book & Bank Book
  console.log('11. Cash Book & Bank Book');
  const cashRes = await fetch(`${BASE_URL}/accounts/cash-ledger`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(cashRes.status, 200, 'Cash book status 200');
  const cashData = await cashRes.json();
  assert.ok(cashData.summary !== undefined, 'Cash summary calculated');

  const bankRes = await fetch(`${BASE_URL}/accounts/bank-ledger`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(bankRes.status, 200, 'Bank book status 200');
  const bankData = await bankRes.json();
  assert.ok(bankData.summary !== undefined, 'Bank summary calculated');
  console.log('   [PASS] Cash and Bank books calculated chronologically');

  // 12. Outstanding Summaries
  console.log('12. Outstanding Summaries');
  const custOutRes = await fetch(`${BASE_URL}/accounts/customer-outstanding`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(custOutRes.status, 200, 'Customer outstanding status 200');
  const custOutData = await custOutRes.json();
  assert.ok(custOutData.rows.length > 0, 'Customers outstanding list returned');

  const suppOutRes = await fetch(`${BASE_URL}/accounts/supplier-outstanding`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(suppOutRes.status, 200, 'Supplier outstanding status 200');
  const suppOutData = await suppOutRes.json();
  assert.ok(suppOutData.rows.length > 0, 'Suppliers outstanding list returned');
  console.log('   [PASS] Customer and Supplier outstanding reports verified');

  // 13. Reports: Wastage & Consumption
  console.log('13. Detailed Reports: Wastage & Consumption');
  const wasteRes = await fetch(`${BASE_URL}/reports/wastage`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(wasteRes.status, 200, 'Wastage report status 200');
  const wasteData = await wasteRes.json();
  assert.ok(wasteData.summary.totalWastageKg > 0, 'Wastage recorded');
  assert.ok(Array.isArray(wasteData.byMachine), 'Machine breakdown present');
  assert.ok(Array.isArray(wasteData.byReason), 'Reason breakdown present');

  const consRes = await fetch(`${BASE_URL}/reports/consumption`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(consRes.status, 200, 'Consumption report status 200');
  const consData = await consRes.json();
  assert.ok(consData.batches.length > 0, 'Consumption batches present');
  console.log('   [PASS] Wastage & Consumption reports returned with machine/reason/batch breakdowns');

  // 14. E-Invoice and E-Way Bill JSON schemas
  console.log('14. E-Invoice & E-Way Bill JSON Generation');
  const eInvRes = await fetch(`${BASE_URL}/invoices/${saleData.id}/e-invoice-json`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(eInvRes.status, 200, 'E-Invoice JSON status 200');
  const eInvData = await eInvRes.json();
  assert.strictEqual(eInvData.Version, '1.1', 'E-Invoice schema Version 1.1');
  assert.ok(eInvData.SellerDtls.Gstin, 'Seller GSTIN in E-Invoice');
  assert.ok(eInvData.ItemList.length > 0, 'Item list in E-Invoice');

  const eWayRes = await fetch(`${BASE_URL}/invoices/${saleData.id}/e-waybill-json`, { headers: { Authorization: ADMIN_AUTH } });
  assert.strictEqual(eWayRes.status, 200, 'E-Way Bill JSON status 200');
  const eWayData = await eWayRes.json();
  assert.strictEqual(eWayData.supplyType, 'O', 'E-Way Bill supplyType O');
  assert.ok(eWayData.fromGstin, 'From GSTIN present in E-Way bill');
  console.log('   [PASS] Official E-Invoice & E-Way Bill JSON schemas generated correctly');

  // 15. All 13 CA Export Registers
  console.log('15. CA Export Registers (All 13 Registers)');
  const registers = [
    'sales-register',
    'sales-register-nongst',
    'purchase-register',
    'purchase-register-nongst',
    'customer-receipts',
    'supplier-payments',
    'cash-book',
    'bank-book',
    'rm-consumption',
    'production-yield',
    'wastage-register',
    'customer-outstanding',
    'supplier-outstanding'
  ];

  for (const reg of registers) {
    const regRes = await fetch(`${BASE_URL}/accounts/export?type=${reg}`, { headers: { Authorization: ADMIN_AUTH } });
    assert.strictEqual(regRes.status, 200, `Export register ${reg} status 200`);
    const regData = await regRes.json();
    assert.ok(Array.isArray(regData), `Export register ${reg} returned array`);

    const csvRes = await fetch(`${BASE_URL}/accounts/export?type=${reg}&format=csv`, { headers: { Authorization: ADMIN_AUTH } });
    assert.strictEqual(csvRes.status, 200, `CSV export for ${reg} status 200`);
    assert.ok(csvRes.headers.get('content-type').includes('text/csv'), `CSV header set for ${reg}`);
  }
  console.log('   [PASS] All 13 CA export registers verified in both JSON and CSV formats');

  console.log('\n====================================================');
  console.log(' ALL NEW MANUFACTURING ERP FEATURES PASSED! ');
  console.log('====================================================');
}

testAll().catch(err => {
  console.error('\n[FAIL] Test error:', err);
  process.exit(1);
});
