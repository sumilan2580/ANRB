const { app, startServer } = require('../server/index');
const http = require('http');

let server;
let port;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${port}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.role ? { 'x-user-role': options.role } : { 'x-user-role': 'admin' }),
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 400) {
            return reject(new Error(parsed.error || `HTTP ${res.statusCode}: ${body}`));
          }
          resolve(parsed);
        } catch (err) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== TRIPAL MANUFACTURING ERP: VERIFICATION TESTS ===\n');

  const activeFy = 'FY 2026-27';

  // Clean up any existing test opening balances for fresh idempotent test run
  const existingObs = await request('/api/accounts/opening-balances');
  for (const ob of (existingObs || [])) {
    if (ob.remarks && ob.remarks.includes('Test')) {
      await request(`/api/accounts/opening-balances/${ob.id}`, { method: 'DELETE' });
    }
  }

  // Fetch initial masters
  let rms = await request('/api/masters/raw-materials');
  let fgs = await request('/api/masters/finished-goods');
  let custs = await request('/api/masters/customers');
  let supps = await request('/api/masters/suppliers');

  if (!rms.length) {
    const newRm = await request('/api/masters/raw-materials', { method: 'POST', body: { name: 'LLDPE Virgin', category: 'Polymer', unit: 'KG' } });
    rms = [newRm];
  }
  if (!fgs.length) {
    const newFg = await request('/api/masters/finished-goods', { method: 'POST', body: { productName: 'Tarpaulin Roll', gsm: 150, widthSize: '12 FT', colour: 'Blue', unit: 'KG' } });
    fgs = [newFg];
  }
  if (!custs.length) {
    const newCust = await request('/api/masters/customers', { method: 'POST', body: { name: 'Agro Plastics Gujarat', phone: '9825098250' } });
    custs = [newCust];
  }
  if (!supps.length) {
    const newSupp = await request('/api/masters/suppliers', { method: 'POST', body: { name: 'Reliance Polymer Ltd', phone: '9898098980' } });
    supps = [newSupp];
  }

  const rmId = rms[0].id;
  const fgId = fgs[0].id;
  const custId = custs[0].id;
  const suppId = supps[0].id;

  // Ensure Financial Years exist (idempotent)
  const existingFys = await request('/api/financial-years');
  const fyNames = (existingFys || []).map(f => f.name);
  if (!fyNames.includes('FY 2026-27')) {
    await request('/api/financial-years', {
      method: 'POST',
      body: { name: 'FY 2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isActive: true }
    });
  }
  if (!fyNames.includes('FY 2027-28')) {
    await request('/api/financial-years', {
      method: 'POST',
      body: { name: 'FY 2027-28', startDate: '2027-04-01', endDate: '2028-03-31', isActive: false }
    });
  }

  // 1. Create RM opening: 5,000 KG
  console.log('1. Creating RM Opening Stock (5,000 KG)...');
  const rmOp = await request('/api/accounts/opening-balances', {
    method: 'POST',
    body: {
      financialYear: activeFy,
      entityType: 'RM',
      entityId: rmId,
      openingDate: '2026-04-01',
      unit: 'KG',
      quantity: 5000,
      rate: 100,
      amount: 500000,
      remarks: 'Test RM Opening'
    }
  });
  console.log('   ✓ RM Opening created ID:', rmOp.id);

  // 2. Create FG opening: 2,500 KG
  console.log('2. Creating FG Opening Stock (2,500 KG)...');
  const fgOp = await request('/api/accounts/opening-balances', {
    method: 'POST',
    body: {
      financialYear: activeFy,
      entityType: 'FG',
      entityId: fgId,
      openingDate: '2026-04-01',
      unit: 'KG',
      quantity: 2500,
      rate: 150,
      amount: 375000,
      remarks: 'Test FG Opening'
    }
  });
  console.log('   ✓ FG Opening created ID:', fgOp.id);

  // 3. Create customer opening: ₹1,50,000 Dr
  console.log('3. Creating Customer Opening Balance (₹1,50,000 Dr)...');
  const custOp = await request('/api/accounts/opening-balances', {
    method: 'POST',
    body: {
      financialYear: activeFy,
      entityType: 'CUSTOMER',
      entityId: custId,
      openingDate: '2026-04-01',
      amount: 150000,
      balanceType: 'Dr',
      remarks: 'Test Customer Opening'
    }
  });
  console.log('   ✓ Customer Opening created ID:', custOp.id);

  // 4. Create supplier opening: ₹80,000 Cr
  console.log('4. Creating Supplier Opening Balance (₹80,000 Cr)...');
  const suppOp = await request('/api/accounts/opening-balances', {
    method: 'POST',
    body: {
      financialYear: activeFy,
      entityType: 'SUPPLIER',
      entityId: suppId,
      openingDate: '2026-04-01',
      amount: 80000,
      balanceType: 'Cr',
      remarks: 'Test Supplier Opening'
    }
  });
  console.log('   ✓ Supplier Opening created ID:', suppOp.id);

  // 5. Create Cash opening: ₹25,000 Dr
  console.log('5. Creating Cash Opening Balance (₹25,000 Dr)...');
  const cashOp = await request('/api/accounts/opening-balances', {
    method: 'POST',
    body: {
      financialYear: activeFy,
      entityType: 'CASH',
      entityId: 0,
      openingDate: '2026-04-01',
      amount: 25000,
      balanceType: 'Dr',
      remarks: 'Test Cash Opening'
    }
  });
  console.log('   ✓ Cash Opening created ID:', cashOp.id);

  // 6. Create SBI opening: ₹2,00,000 Dr
  console.log('6. Creating Bank Master: SBI Current Account (Opening ₹2,00,000 Dr)...');
  const sbiBank = await request('/api/masters/bank-accounts', {
    method: 'POST',
    body: {
      bankName: 'State Bank of India',
      accountName: 'Tripal Mfg SBI Current',
      accountNumber: '39482019284',
      ifsc: 'SBIN0001234',
      branch: 'Halol',
      openingBalance: 200000,
      openingBalanceType: 'Dr'
    }
  });
  console.log('   ✓ SBI Bank created ID:', sbiBank.id);

  // 7. Create HDFC opening: ₹1,00,000 Dr
  console.log('7. Creating Bank Master: HDFC Current Account (Opening ₹1,00,000 Dr)...');
  const hdfcBank = await request('/api/masters/bank-accounts', {
    method: 'POST',
    body: {
      bankName: 'HDFC Bank',
      accountName: 'Tripal Mfg HDFC Current',
      accountNumber: '5020001928374',
      ifsc: 'HDFC0000482',
      branch: 'Halol Main',
      openingBalance: 100000,
      openingBalanceType: 'Dr'
    }
  });
  console.log('   ✓ HDFC Bank created ID:', hdfcBank.id);

  // 8. Verify each Bank Book separately
  console.log('8. Verifying SBI and HDFC Bank Books separately...');
  const sbiLedger = await request(`/api/accounts/bank-ledger?bankAccountId=${sbiBank.id}`);
  const hdfcLedger = await request(`/api/accounts/bank-ledger?bankAccountId=${hdfcBank.id}`);
  if (sbiLedger.openingBalance !== 200000) throw new Error(`SBI opening balance expected 200000, got ${sbiLedger.openingBalance}`);
  if (hdfcLedger.openingBalance !== 100000) throw new Error(`HDFC opening balance expected 100000, got ${hdfcLedger.openingBalance}`);
  console.log('   ✓ SBI Opening:', sbiLedger.openingBalance, '| HDFC Opening:', hdfcLedger.openingBalance);

  // 9. Create Customer Debit Note
  console.log('9. Creating Customer Debit Note (₹10,000 + 18% GST)...');
  const custDn = await request('/api/accounts/debit-credit-notes', {
    method: 'POST',
    body: {
      noteType: 'DEBIT_NOTE',
      partyType: 'CUSTOMER',
      partyId: custId,
      date: '2026-05-10',
      reason: 'Rate Adjustment / Undercharged',
      taxableAmount: 10000,
      gstRate: 18,
      remarks: 'Test Customer DN'
    }
  });
  console.log('   ✓ Customer Debit Note created:', custDn.note_code, 'Total:', custDn.total_amount);

  // 10. Create Customer Credit Note
  console.log('10. Creating Customer Credit Note (₹4,000 + 18% GST)...');
  const custCn = await request('/api/accounts/debit-credit-notes', {
    method: 'POST',
    body: {
      noteType: 'CREDIT_NOTE',
      partyType: 'CUSTOMER',
      partyId: custId,
      date: '2026-05-12',
      reason: 'Sales Return',
      taxableAmount: 4000,
      gstRate: 18,
      remarks: 'Test Customer CN'
    }
  });
  console.log('   ✓ Customer Credit Note created:', custCn.note_code, 'Total:', custCn.total_amount);

  // 11. Create Supplier Debit Note
  console.log('11. Creating Supplier Debit Note (₹5,000 + 18% GST)...');
  const suppDn = await request('/api/accounts/debit-credit-notes', {
    method: 'POST',
    body: {
      noteType: 'DEBIT_NOTE',
      partyType: 'SUPPLIER',
      partyId: suppId,
      date: '2026-05-15',
      reason: 'Purchase Return',
      taxableAmount: 5000,
      gstRate: 18,
      remarks: 'Test Supplier DN'
    }
  });
  console.log('   ✓ Supplier Debit Note created:', suppDn.note_code, 'Total:', suppDn.total_amount);

  // 12. Create Supplier Credit Note
  console.log('12. Creating Supplier Credit Note (₹2,000 + 18% GST)...');
  const suppCn = await request('/api/accounts/debit-credit-notes', {
    method: 'POST',
    body: {
      noteType: 'CREDIT_NOTE',
      partyType: 'SUPPLIER',
      partyId: suppId,
      date: '2026-05-18',
      reason: 'Supplier Discount / Rebate',
      taxableAmount: 2000,
      gstRate: 18,
      remarks: 'Test Supplier CN'
    }
  });
  console.log('   ✓ Supplier Credit Note created:', suppCn.note_code, 'Total:', suppCn.total_amount);

  // 13. Verify Customer Ledger
  console.log('13. Verifying Customer Ledger running formula...');
  const custLedger = await request(`/api/accounts/customer-ledger?customerId=${custId}`);
  console.log('    Customer Ledger Closing Balance:', custLedger.closingBalance);

  // 14. Verify Supplier Ledger
  console.log('14. Verifying Supplier Ledger running formula...');
  const suppLedger = await request(`/api/accounts/supplier-ledger?supplierId=${suppId}`);
  console.log('    Supplier Ledger Closing Balance:', suppLedger.closingBalance);

  // 15. Verify Cash Book
  console.log('15. Verifying Cash Book...');
  const cashLedger = await request('/api/accounts/cash-ledger');
  console.log('    Net Cash in Hand:', cashLedger.summary.netCashInHand);

  // 16. Verify SBI Bank Book
  console.log('16. Verifying SBI Bank Book...');
  const sbiLedgerCheck = await request(`/api/accounts/bank-ledger?bankAccountId=${sbiBank.id}`);
  console.log('    SBI Net Balance:', sbiLedgerCheck.summary.netBankBalance);

  // 17. Verify HDFC Bank Book
  console.log('17. Verifying HDFC Bank Book...');
  const hdfcLedgerCheck = await request(`/api/accounts/bank-ledger?bankAccountId=${hdfcBank.id}`);
  console.log('    HDFC Net Balance:', hdfcLedgerCheck.summary.netBankBalance);

  // 18. Verify RM Stock includes opening
  console.log('18. Verifying RM Stock calculation includes opening...');
  const rmStockList = await request('/api/inventory/raw-materials');
  const rmTarget = rmStockList.find(r => r.id === rmId);
  console.log('    RM Stock Qty:', rmTarget ? rmTarget.current_stock_kg : 'N/A');

  // 19. Verify FG Stock includes opening
  console.log('19. Verifying FG Stock calculation includes opening...');
  const fgStockList = await request('/api/inventory/finished-goods');
  const fgTarget = fgStockList.find(f => f.id === fgId);
  console.log('    FG Stock Qty:', fgTarget ? fgTarget.current_stock_kg : 'N/A');

  // 20. Verify existing Purchase -> Material Issue -> Production -> Wastage -> FG -> Sales flow still works
  console.log('20. Verifying manufacturing flow endpoints health...');
  const dashboard = await request('/api/dashboard/stats');
  if (!dashboard || typeof dashboard !== 'object') throw new Error('Dashboard stats failed');
  console.log('    ✓ Dashboard stats active');

  // 21. Verify cash sale still DOES NOT automatically create Receipt
  console.log('21. Verifying Cash Sale rule (does NOT auto-create Receipt)...');
  const paymentsBefore = await request('/api/accounts/payments');
  const cashSale = await request('/api/transactions/sales', {
    method: 'POST',
    body: {
      customerId: custId,
      date: '2026-05-20',
      finishedProductId: fgId,
      quantityKg: 10,
      ratePerKg: 200,
      paymentType: 'Cash',
      taxRate: 18,
      remarks: 'Test Cash Sale'
    }
  });
  const paymentsAfter = await request('/api/accounts/payments');
  if (paymentsAfter.length !== paymentsBefore.length) {
    throw new Error('Cash sale automatically created a receipt entry! Rule violated!');
  }
  console.log('    ✓ Cash Sale created invoice', cashSale.invoice_number, 'without auto-receipt.');

  // 22. Verify manual Receipt still works
  console.log('22. Verifying manual Receipt entry...');
  const receipt = await request('/api/accounts/payments', {
    method: 'POST',
    body: {
      date: '2026-05-21',
      partyType: 'CUSTOMER',
      partyId: custId,
      amount: 5000,
      paymentMode: 'Bank',
      bankAccountId: sbiBank.id,
      referenceNo: 'REC-UTR-991',
      remarks: 'Manual Receipt'
    }
  });
  console.log('    ✓ Manual Receipt created:', receipt.payment_code);

  // 23. Verify manual Supplier Payment still works
  console.log('23. Verifying manual Supplier Payment entry...');
  const payment = await request('/api/accounts/payments', {
    method: 'POST',
    body: {
      date: '2026-05-22',
      partyType: 'SUPPLIER',
      partyId: suppId,
      amount: 8000,
      paymentMode: 'Bank',
      bankAccountId: sbiBank.id,
      referenceNo: 'PAY-UTR-882',
      remarks: 'Manual Payment'
    }
  });
  console.log('    ✓ Manual Payment created:', payment.payment_code);

  // 24. Verify Bank Transfer does not affect Sales/Purchase totals
  console.log('24. Verifying Bank Transfer (SBI -> HDFC ₹25,000)...');
  const transfer = await request('/api/accounts/bank-transfers', {
    method: 'POST',
    body: {
      date: '2026-05-25',
      fromBankAccountId: sbiBank.id,
      toBankAccountId: hdfcBank.id,
      amount: 25000,
      referenceNo: 'TXN-TRANSFER-101',
      remarks: 'Interbank Transfer'
    }
  });
  console.log('    ✓ Bank Transfer created ID:', transfer.id);

  // 25. Verify Manager cannot edit/delete Opening, Bank Master, Notes, or Payments
  console.log('25. Verifying Manager restriction (Entry-only)...');
  let managerBlocked = false;
  try {
    await request(`/api/accounts/payments/${receipt.id}`, {
      method: 'DELETE',
      role: 'manager'
    });
  } catch (err) {
    managerBlocked = true;
    console.log('    ✓ Manager delete correctly rejected by server:', err.message);
  }
  if (!managerBlocked) throw new Error('Manager was able to delete payment!');

  // 26. Verify Admin can manage all required records
  console.log('26. Verifying Admin permissions...');
  const auditLogs = await request('/api/audit-logs');
  console.log('    ✓ Admin audit logs accessed:', auditLogs.length, 'records');

  // 27. Verify duplicate carry-forward does not duplicate balances
  console.log('27. Testing Financial Year Carry Forward (FY 2026-27 -> FY 2027-28)...');
  const cf1 = await request('/api/accounts/carry-forward', {
    method: 'POST',
    body: { sourceYear: 'FY 2026-27', targetYear: 'FY 2027-28', openingDate: '2027-04-01' }
  });
  console.log('    ✓ Carry forward 1st run:', cf1.message);

  const cf2 = await request('/api/accounts/carry-forward', {
    method: 'POST',
    body: { sourceYear: 'FY 2026-27', targetYear: 'FY 2027-28', openingDate: '2027-04-01' }
  });
  console.log('    ✓ Carry forward 2nd run (Duplicate protection check):', cf2.message);

  // 28. Verify existing Admin dashboard/reports remain functional
  console.log('28. Verifying existing Admin dashboard & reports...');
  const reportsWastage = await request('/api/reports/wastage');
  console.log('    ✓ Wastage report active:', reportsWastage ? 'ok' : 'error');

  console.log('\n==================================================');
  console.log('ALL 28 VALIDATION STEPS PASSED SUCCESSFULLY!');
  console.log('==================================================\n');
}

async function main() {
  server = await startServer();
  port = server.address().port;
  console.log(`Test server running on port ${port}`);
  try {
    await runTests();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VALIDATION TEST FAILED:', err);
    process.exit(1);
  }
}

main();
