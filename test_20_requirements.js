const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-role': 'admin',
      ...(options.headers || {})
    },
    ...options
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('TRIPAL ERP — 20 FINAL VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // TEST 1: Create multi-item purchase under one invoice
  let purchaseId;
  let rm1StockBefore, rm2StockBefore;
  await test('TEST 1: Create multi-item purchase under one invoice', async () => {
    const rmRes = await req('/api/inventory/raw-materials');
    const rm1 = rmRes.data.find(r => r.code === 'RM-001' || r.id === 1);
    const rm2 = rmRes.data.find(r => r.code === 'RM-002' || r.id === 2);
    rm1StockBefore = rm1.current_stock_kg;
    rm2StockBefore = rm2.current_stock_kg;

    const res = await req('/api/transactions/purchases', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        supplierId: 1,
        purchaseType: 'GST',
        invoiceNumber: 'SUP-INV-9901',
        paymentMode: 'Credit',
        items: [
          { rawMaterialId: rm1.id, quantity: 200, rate: 100, unit: 'KG' },
          { rawMaterialId: rm2.id, quantity: 150, rate: 120, unit: 'KG' }
        ]
      })
    });
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.id, 'Purchase ID must be returned');
    purchaseId = res.data.id;
  });

  // TEST 2: Verify each purchased material increases its own stock
  await test('TEST 2: Verify each purchased material increases its own stock', async () => {
    const rmRes = await req('/api/inventory/raw-materials');
    const rm1 = rmRes.data.find(r => r.code === 'RM-001' || r.id === 1);
    const rm2 = rmRes.data.find(r => r.code === 'RM-002' || r.id === 2);
    assert.strictEqual(rm1.current_stock_kg, rm1StockBefore + 200, 'RM-001 stock should increase by 200');
    assert.strictEqual(rm2.current_stock_kg, rm2StockBefore + 150, 'RM-002 stock should increase by 150');
  });

  // TEST 3: Create Material Issue Batch
  let consumptionBatchId;
  let batchNo;
  await test('TEST 3: Create Material Issue Batch', async () => {
    const res = await req('/api/transactions/consumption-batches', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        productionOrderId: 1,
        machineId: 1,
        shiftId: 1,
        status: 'Issued',
        items: [
          { rawMaterialId: 1, quantity: 50, unit: 'KG' }
        ]
      })
    });
    assert.strictEqual(res.status, 201, `Expected 201: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.id, 'Batch ID must be returned');
    consumptionBatchId = res.data.id;
    batchNo = res.data.batch_no;
  });

  // TEST 4: Open Manufacturing & Wastage -> select that batch, verify machine, shift, material-used details auto-fill
  await test('TEST 4: Manufacturing batch pre-fill details verified', async () => {
    const res = await req(`/api/transactions/consumption-batches?productionReady=true`);
    assert.strictEqual(res.status, 200);
    const found = res.data.find(b => b.id === consumptionBatchId);
    assert.ok(found, 'Created consumption batch must be listed for production');
    assert.ok(found.machine_name, 'Machine name must be populated');
    assert.ok(found.shift_name, 'Shift name must be populated');
    assert.ok(found.items && found.items.length > 0, 'Items must be populated');
  });

  // TEST 5: Enter FG output + wastage, verify stock updates correctly
  let fgStockBefore;
  let prodBatchId;
  await test('TEST 5: Enter FG output + wastage and verify stock updates', async () => {
    const fgRes = await req('/api/inventory/finished-goods');
    const fg1 = fgRes.data.find(f => f.id === 1);
    fgStockBefore = fg1.current_stock_kg;

    const res = await req('/api/transactions/production', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        consumptionBatchId: consumptionBatchId,
        productionOrderId: 1,
        machineId: 1,
        shiftId: 1,
        rawMaterialId: 1,
        rawMaterialUsedKg: 50,
        totalWastageKg: 2,
        wastageReason: 'Trim edge loss',
        outputs: [
          { finishedProductId: 1, quantityKg: 48, unit: 'KG' }
        ]
      })
    });
    assert.strictEqual(res.status, 201, `Expected 201: ${JSON.stringify(res.data)}`);
    prodBatchId = res.data.id;

    const fgResAfter = await req('/api/inventory/finished-goods');
    const fg1After = fgResAfter.data.find(f => f.id === 1);
    assert.strictEqual(fg1After.current_stock_kg, fgStockBefore + 48, 'FG stock must increase by 48 KG');
  });

  // TEST 6: Create Sale with invoice INV/001
  let saleAId;
  await test('TEST 6: Create Sale with custom invoice INV/001', async () => {
    const res = await req('/api/transactions/sales', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        customerId: 1,
        invoiceNumber: 'INV/001',
        salesType: 'GST',
        paymentType: 'Credit',
        items: [
          { finishedProductId: 1, quantity: 10, rate: 200, unit: 'KG' }
        ]
      })
    });
    assert.strictEqual(res.status, 201, `Expected 201: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.invoice_number, 'INV/001');
    saleAId = res.data.id;
  });

  // TEST 7: Create Sale with invoice INV/002
  let saleBId;
  await test('TEST 7: Create Sale with custom invoice INV/002', async () => {
    const res = await req('/api/transactions/sales', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        customerId: 1,
        invoiceNumber: 'INV/002',
        salesType: 'GST',
        paymentType: 'Credit',
        items: [
          { finishedProductId: 1, quantity: 5, rate: 200, unit: 'KG' }
        ]
      })
    });
    assert.strictEqual(res.status, 201, `Expected 201: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.invoice_number, 'INV/002');
    saleBId = res.data.id;
  });

  // TEST 8: Try duplicate INV/001 -> Must be rejected
  await test('TEST 8: Try duplicate INV/001 -> Must be rejected with exact error', async () => {
    const res = await req('/api/transactions/sales', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        customerId: 1,
        invoiceNumber: 'INV/001',
        salesType: 'GST',
        paymentType: 'Credit',
        items: [
          { finishedProductId: 1, quantity: 5, rate: 200, unit: 'KG' }
        ]
      })
    });
    assert.strictEqual(res.status, 400, `Expected 400 rejection, got ${res.status}`);
    assert.ok(
      res.data?.error?.includes('Invoice number already exists. Please enter a different invoice number.'),
      `Expected duplicate message, got: ${res.data?.error}`
    );
  });

  // TEST 9: Create Cash Sale -> Verify NO automatic Receipt is created
  let cashSaleId;
  await test('TEST 9: Create Cash Sale -> Verify NO automatic Receipt is created', async () => {
    const payBefore = await req('/api/accounts/payments');
    const payCountBefore = payBefore.data.length;

    const res = await req('/api/transactions/sales', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        customerId: 1,
        invoiceNumber: 'CASH/2026/001',
        salesType: 'GST',
        paymentType: 'Cash',
        items: [
          { finishedProductId: 1, quantity: 5, rate: 150, unit: 'KG' }
        ]
      })
    });
    assert.strictEqual(res.status, 201);
    cashSaleId = res.data.id;

    const payAfter = await req('/api/accounts/payments');
    assert.strictEqual(payAfter.data.length, payCountBefore, 'No automatic payment/receipt should be created from cash sale');
  });

  // TEST 10: Manually create Receipt -> Verify Cash Book / Party Ledger updates
  let receiptId;
  let receiptCode;
  await test('TEST 10: Manually create Receipt -> Verify Cash Book updates', async () => {
    const res = await req('/api/accounts/payments', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        partyType: 'CUSTOMER',
        partyId: 1,
        amount: 885,
        paymentMode: 'Cash',
        remarks: 'Manual cash receipt for sale'
      })
    });
    assert.strictEqual(res.status, 201);
    receiptId = res.data.id;
    receiptCode = res.data.payment_code;

    const cashBook = await req('/api/accounts/cash-ledger');
    assert.strictEqual(cashBook.status, 200);
    const recEntry = cashBook.data.transactions?.find(r => r.doc_no === receiptCode);
    assert.ok(recEntry, 'Receipt must appear in Cash Book transactions');
  });

  // TEST 11: Manually create Payment -> Verify Cash/Bank/Supplier Ledger updates
  let paymentId;
  let paymentCode;
  await test('TEST 11: Manually create Payment -> Verify Bank Book updates', async () => {
    const res = await req('/api/accounts/payments', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-10',
        partyType: 'SUPPLIER',
        partyId: 1,
        amount: 15000,
        paymentMode: 'Bank',
        remarks: 'Manual bank payment to supplier'
      })
    });
    assert.strictEqual(res.status, 201);
    paymentId = res.data.id;
    paymentCode = res.data.payment_code;

    const bankBook = await req('/api/accounts/bank-ledger');
    assert.strictEqual(bankBook.status, 200);
    const payEntry = bankBook.data.transactions?.find(p => p.doc_no === paymentCode);
    assert.ok(payEntry, 'Payment must appear in Bank Book transactions');
  });

  // TEST 12: Admin edits Receipt -> Verify ledger balance updates correctly
  await test('TEST 12: Admin edits Receipt -> Verify ledger balance updates', async () => {
    const res = await req(`/api/accounts/payments/${receiptId}`, {
      method: 'PUT',
      body: JSON.stringify({
        amount: 1000,
        paymentMode: 'Cash',
        remarks: 'Corrected receipt amount'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.amount, 1000);

    const cashBook = await req('/api/accounts/cash-ledger');
    const recEntry = cashBook.data.transactions?.find(r => r.doc_no === receiptCode);
    assert.strictEqual(recEntry.inflow, 1000, 'Cash book should reflect edited amount 1000');
  });

  // TEST 13: Admin deletes Receipt -> Verify ledger balance reverses correctly
  await test('TEST 13: Admin deletes Receipt -> Verify ledger balance reverses', async () => {
    const res = await req(`/api/accounts/payments/${receiptId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 200);

    const cashBook = await req('/api/accounts/cash-ledger');
    const recEntry = cashBook.data.transactions?.find(r => r.doc_no === receiptCode);
    assert.strictEqual(recEntry, undefined, 'Deleted receipt must no longer appear in active cash book');
  });

  // TEST 14: Admin edits Sale -> Verify stock/ledger remains correct
  await test('TEST 14: Admin edits Sale -> Verify stock/ledger remains correct and duplicate checked', async () => {
    // Attempt duplicate invoice edit first
    const dupRes = await req(`/api/transactions/sales/${saleAId}`, {
      method: 'PUT',
      body: JSON.stringify({
        date: '2026-09-10',
        customerId: 1,
        invoiceNumber: 'INV/002', // Already used by saleBId!
        items: [{ finishedProductId: 1, quantity: 10, rate: 200 }]
      })
    });
    assert.strictEqual(dupRes.status, 400, 'Duplicate invoice in PUT must be rejected');

    // Valid edit: change quantity from 10 to 12
    const fgResBefore = await req('/api/inventory/finished-goods');
    const fgBefore = fgResBefore.data.find(f => f.id === 1).current_stock_kg;

    const editRes = await req(`/api/transactions/sales/${saleAId}`, {
      method: 'PUT',
      body: JSON.stringify({
        date: '2026-09-10',
        customerId: 1,
        invoiceNumber: 'INV/001-REV',
        items: [{ finishedProductId: 1, quantity: 12, rate: 200 }]
      })
    });
    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.data.invoice_number, 'INV/001-REV');

    const fgResAfter = await req('/api/inventory/finished-goods');
    const fgAfter = fgResAfter.data.find(f => f.id === 1).current_stock_kg;
    assert.strictEqual(fgAfter, fgBefore - 2, 'Stock should decrease by 2 net (10 -> 12)');
  });

  // TEST 15: Admin deletes Sale -> Verify FG stock is restored correctly
  await test('TEST 15: Admin deletes Sale -> Verify FG stock is restored', async () => {
    const fgResBefore = await req('/api/inventory/finished-goods');
    const fgBefore = fgResBefore.data.find(f => f.id === 1).current_stock_kg;

    const res = await req(`/api/transactions/sales/${saleAId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 200);

    const fgResAfter = await req('/api/inventory/finished-goods');
    const fgAfter = fgResAfter.data.find(f => f.id === 1).current_stock_kg;
    assert.strictEqual(fgAfter, fgBefore + 12, '12 KG must be restored to FG stock');
  });

  // TEST 16: Open invoice -> Verify no "no such column: c.city" error
  await test('TEST 16: Open invoice modal endpoint -> No "no such column: c.city" error', async () => {
    const res = await req(`/api/invoices/${saleBId}`);
    assert.strictEqual(res.status, 200, `Invoice fetch failed: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.customer, 'Customer data must be returned');
    assert.ok(res.data.customer.city, 'Customer city must be present');
    assert.strictEqual(res.data.invoice.invoiceNumber, 'INV/002');
  });

  // TEST 17: Generate PDF / Verify correct invoice number
  await test('TEST 17: Tax Invoice endpoint returns exact sale invoice number', async () => {
    const res = await req(`/api/invoices/${saleBId}`);
    assert.strictEqual(res.data.invoice.invoiceNumber, 'INV/002');
    assert.ok(res.data.invoice.saleCode.startsWith('SALE-'), `Expected saleCode to start with SALE-, got: ${res.data.invoice.saleCode}`);
  });

  // TEST 18: Download E-Invoice JSON -> Verify correct invoice number
  await test('TEST 18: Download E-Invoice JSON -> Contains correct invoice number', async () => {
    const res = await req(`/api/invoices/${saleBId}/e-invoice-json`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.DocDtls.No, 'INV/002');
  });

  // TEST 19: Download E-Way Bill JSON -> Verify correct invoice number
  await test('TEST 19: Download E-Way Bill JSON -> Contains correct invoice number', async () => {
    const res = await req(`/api/invoices/${saleBId}/e-waybill-json`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.docNo, 'INV/002');
  });

  // TEST 20: Verify all clearly identifiable DEMO/TEST transactions are removed
  await test('TEST 20: Verify zero demo/test manager accounts and test records', async () => {
    const mgrRes = await req('/api/masters/managers');
    assert.strictEqual(mgrRes.status, 200);
    const testMgrs = mgrRes.data.filter(m => m.name.toLowerCase().includes('test') || m.name.toLowerCase().includes('diag'));
    assert.strictEqual(testMgrs.length, 0, `Expected 0 test managers, found: ${testMgrs.map(m => m.name)}`);

    const salesRes = await req('/api/transactions/sales');
    const testSales = salesRes.data.filter(s => s.manager_name === 'TestManagerRakesh');
    assert.strictEqual(testSales.length, 0, 'No sales by TestManagerRakesh');

    const purRes = await req('/api/transactions/purchases');
    const testPurs = purRes.data.filter(p => p.manager_name === 'TestManagerRakesh');
    assert.strictEqual(testPurs.length, 0, 'No purchases by TestManagerRakesh');
  });

  // CLEANUP test records created during this run
  console.log('\nCleaning up verification run records...');
  await req(`/api/transactions/sales/${saleBId}`, { method: 'DELETE' }).catch(() => {});
  await req(`/api/transactions/sales/${cashSaleId}`, { method: 'DELETE' }).catch(() => {});
  await req(`/api/accounts/payments/${paymentId}`, { method: 'DELETE' }).catch(() => {});
  await req(`/api/transactions/production/${prodBatchId}`, { method: 'DELETE' }).catch(() => {});
  await req(`/api/transactions/consumption-batches/${consumptionBatchId}`, { method: 'DELETE' }).catch(() => {});
  await req(`/api/transactions/purchases/${purchaseId}`, { method: 'DELETE' }).catch(() => {});

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
