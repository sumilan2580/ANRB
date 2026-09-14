const http = require('http');
async function test(url, opts) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: (opts&&opts.method)||'GET', headers: (opts&&opts.headers)||{} }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    if (opts && opts.body) req.write(opts.body);
    req.end();
  });
}

async function run() {
  const base = 'http://localhost:5000/api';
  const admin = { Authorization: 'Basic ' + Buffer.from('admin:admin123').toString('base64'), 'Content-Type': 'application/json' };
  let pass = 0, fail = 0;

  function log(condition, label, detail) {
    if (condition) { console.log('  [PASS] ' + label + (detail ? ' — ' + detail : '')); pass++; }
    else           { console.log('  [FAIL] ' + label + (detail ? ' — ' + detail : '')); fail++; }
  }

  console.log('\n=== FULL LIVE API SMOKE TEST ===\n');

  // --- AUTH ---
  console.log('--- Auth & Admin ---');
  let r = await test(base + '/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin',password:'admin123'}) });
  log(r.status === 200, 'Admin login', 'HTTP ' + r.status);
  
  r = await test(base + '/dashboard/stats', { headers: admin });
  log(r.status === 200, 'Dashboard stats', 'HTTP ' + r.status);

  // --- COMPANY SETTINGS ---
  console.log('\n--- Company Profile ---');
  r = await test(base + '/company/settings', { headers: admin });
  const cs = JSON.parse(r.body);
  log(r.status === 200 && cs.company_name, 'GET company settings', cs.company_name);
  
  r = await test(base + '/company/settings', { method: 'PUT', headers: admin, body: JSON.stringify({ company_name: 'TRIPAL MANUFACTURING PVT. LTD.', company_gstin: '24AAACT1234F1Z5', company_state: 'Gujarat', company_state_code: '24', bank_name: 'SBI', bank_ifsc: 'SBIN0001234' }) });
  const us = JSON.parse(r.body);
  log(r.status === 200 && us.success, 'PUT company settings', us.settings && us.settings.company_name);

  // --- MASTERS ---
  console.log('\n--- Masters ---');
  r = await test(base + '/masters/raw-materials', { headers: admin });
  const rms = JSON.parse(r.body);
  log(r.status === 200 && rms.length > 0, 'Raw materials list', rms.length + ' items');

  r = await test(base + '/masters/finished-goods', { headers: admin });
  const fgs = JSON.parse(r.body);
  log(r.status === 200 && fgs.length > 0, 'Finished goods list', fgs.length + ' items');

  r = await test(base + '/masters/customers', { headers: admin });
  const cust = JSON.parse(r.body);
  log(r.status === 200 && cust.length > 0, 'Customers list', cust.length + ' items');

  r = await test(base + '/masters/suppliers', { headers: admin });
  const supp = JSON.parse(r.body);
  log(r.status === 200 && supp.length > 0, 'Suppliers list', supp.length + ' items');

  r = await test(base + '/masters/machines', { headers: admin });
  log(r.status === 200, 'Machines list', 'HTTP ' + r.status);

  r = await test(base + '/masters/shifts', { headers: admin });
  log(r.status === 200, 'Shifts list', 'HTTP ' + r.status);

  r = await test(base + '/masters/managers', { headers: admin });
  const mgrs = JSON.parse(r.body);
  log(r.status === 200, 'Managers list', mgrs.length + ' managers');

  // --- MANAGER AUTH ---
  console.log('\n--- Manager RBAC ---');
  r = await test(base + '/managers/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name:'SmokeTestMgr2', phone:'8888888888', device_id:'smoke-device-02'}) });
  const reg = JSON.parse(r.body);
  log(r.status === 200, 'Manager register', 'HTTP ' + r.status);
  
  const token = reg.managerToken || reg.token || reg.manager_token || '';
  const mgr = { 'X-Manager-Token': token, 'Content-Type': 'application/json' };
  
  r = await test(base + '/masters/raw-materials', { headers: mgr });
  log(r.status === 200, 'Manager: RM masters allowed', 'HTTP ' + r.status);
  
  r = await test(base + '/masters/finished-goods', { headers: mgr });
  log(r.status === 200, 'Manager: FG masters allowed', 'HTTP ' + r.status);

  r = await test(base + '/inventory/raw-materials', { headers: mgr });
  log(r.status === 403, 'Manager: stock blocked (403)', 'HTTP ' + r.status);

  r = await test(base + '/reports/wastage', { headers: mgr });
  log(r.status === 403, 'Manager: reports blocked (403)', 'HTTP ' + r.status);

  r = await test(base + '/audit-logs', { headers: mgr });
  log(r.status === 403, 'Manager: audit logs blocked (403)', 'HTTP ' + r.status);

  // Clean up test manager immediately
  if (reg && reg.manager && reg.manager.id) {
    await test(base + `/masters/managers/${reg.manager.id}`, { method: 'DELETE', headers: admin }).catch(() => {});
  }

  // --- TRANSACTIONS ---
  console.log('\n--- Transactions ---');
  r = await test(base + '/transactions/production-orders', { headers: admin });
  log(r.status === 200, 'Production orders', 'HTTP ' + r.status);

  r = await test(base + '/transactions/consumption-batches', { headers: admin });
  log(r.status === 200, 'Consumption batches', 'HTTP ' + r.status);

  r = await test(base + '/transactions/purchases', { headers: admin });
  log(r.status === 200, 'Purchases', 'HTTP ' + r.status);

  r = await test(base + '/transactions/production', { headers: admin });
  log(r.status === 200, 'Production batches', 'HTTP ' + r.status);

  r = await test(base + '/transactions/sales', { headers: admin });
  log(r.status === 200, 'Sales list', 'HTTP ' + r.status);

  // --- INVENTORY ---
  console.log('\n--- Inventory ---');
  r = await test(base + '/inventory/raw-materials', { headers: admin });
  const inv = JSON.parse(r.body);
  log(r.status === 200 && inv.length > 0, 'RM inventory stock', inv.length + ' items');

  r = await test(base + '/inventory/finished-goods', { headers: admin });
  const fgInv = JSON.parse(r.body);
  log(r.status === 200 && fgInv.length > 0, 'FG inventory stock', fgInv.length + ' items');

  // --- ACCOUNTS ---
  console.log('\n--- Accounts & Ledgers ---');
  r = await test(base + '/accounts/cash-ledger', { headers: admin });
  const cash = JSON.parse(r.body);
  log(r.status === 200 && cash.transactions, 'Cash book', cash.transactions ? cash.transactions.length + ' transactions' : 'no transactions key');

  r = await test(base + '/accounts/bank-ledger', { headers: admin });
  const bank = JSON.parse(r.body);
  log(r.status === 200 && bank.transactions, 'Bank book', bank.transactions ? bank.transactions.length + ' transactions' : 'no transactions key');

  r = await test(base + '/accounts/customer-outstanding', { headers: admin });
  const coOut = JSON.parse(r.body);
  log(r.status === 200 && Array.isArray(coOut.rows), 'Customer outstanding', (coOut.rows ? coOut.rows.length : 0) + ' parties');

  r = await test(base + '/accounts/supplier-outstanding', { headers: admin });
  const soOut = JSON.parse(r.body);
  log(r.status === 200 && Array.isArray(soOut.rows), 'Supplier outstanding', (soOut.rows ? soOut.rows.length : 0) + ' parties');

  // --- CA EXPORTS ---
  console.log('\n--- CA Export Registers (All 16 + Aliases) ---');
  const exports = [
    'sales-register',
    'sales-register-nongst',
    'purchase-register',
    'purchase-register-nongst',
    'customer-receipts',
    'customer-ledger-summary',
    'supplier-payments',
    'supplier-ledger-summary',
    'cash-book',
    'bank-book',
    'rm-consumption',
    'material-issue-register',
    'production-yield',
    'production-register',
    'wastage-register',
    'customer-outstanding',
    'supplier-outstanding',
    'gst-data',
    'rm-stock-ledger',
    'fg-stock-ledger'
  ];
  for (const type of exports) {
    r = await test(base + '/accounts/export?type=' + type, { headers: admin });
    const data = JSON.parse(r.body);
    log(r.status === 200 && Array.isArray(data), 'CA Export: ' + type, Array.isArray(data) ? data.length + ' rows' : typeof data);
  }

  // --- REPORTS ---
  console.log('\n--- Reports ---');
  r = await test(base + '/reports/wastage', { headers: admin });
  log(r.status === 200, 'Wastage report', 'HTTP ' + r.status);

  r = await test(base + '/reports/consumption', { headers: admin });
  log(r.status === 200, 'Consumption report', 'HTTP ' + r.status);

  r = await test(base + '/reports/customer-sales', { headers: admin });
  log(r.status === 200, 'Customer sales report', 'HTTP ' + r.status);

  // --- HEALTH ---
  console.log('\n--- Health ---');
  r = await test(base + '/health');
  const h = JSON.parse(r.body);
  log(r.status === 200 && h.status === 'ok', 'Health check', h.status);

  console.log('\n============================================================');
  console.log('SUMMARY: ' + pass + ' PASSED, ' + fail + ' FAILED');
  console.log('============================================================\n');
}
run().catch(console.error);
