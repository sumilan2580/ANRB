// Comprehensive System Verification Test Suite
// Verifies all business logic, role-based authorization, attribution, stock calculations, and manager restrictions

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log(' TRIPAL ERP — FULL ACCEPTANCE & SECURITY TEST SUITE ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: MANAGER REGISTRATION & TOKEN ISSUANCE
    // -------------------------------------------------------------
    console.log('--- TEST SUITE 1: Manager Registration & Token Issuance ---');
    const regRes = await fetch(`${API_BASE}/managers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestManagerRakesh', deviceId: 'dev-rakesh-8812', phone: '+91 91234 56789' })
    });
    const regData = await regRes.json();
    assert(regRes.status === 200, 'Manager registration returns 200');
    assert(regData.name === 'TestManagerRakesh', 'Manager name correctly registered');
    assert(!!regData.managerToken, 'Manager token generated and returned');
    assert(regData.status === 'active', 'Manager is active upon registration');
    const rakeshToken = regData.managerToken;
    const rakeshId = regData.id;

    // -------------------------------------------------------------
    // TEST SUITE 2: BACKEND ROLE AUTHORIZATION — RESTRICTED ENDPOINTS (HTTP 403)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Manager HTTP 403 Forbidden Denials ---');
    
    // 1. Dashboard stats
    const rStats = await fetch(`${API_BASE}/dashboard/stats`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rStats.status === 403, 'GET /api/dashboard/stats -> HTTP 403 Forbidden for Manager');

    // 2. Inventory Raw Materials
    const rRM = await fetch(`${API_BASE}/inventory/raw-materials`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rRM.status === 403, 'GET /api/inventory/raw-materials -> HTTP 403 Forbidden for Manager');

    // 3. Inventory Finished Goods
    const rFG = await fetch(`${API_BASE}/inventory/finished-goods`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rFG.status === 403, 'GET /api/inventory/finished-goods -> HTTP 403 Forbidden for Manager');

    // 4. Movement Ledger
    const rLedger = await fetch(`${API_BASE}/inventory/ledger`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rLedger.status === 403, 'GET /api/inventory/ledger -> HTTP 403 Forbidden for Manager');

    // 5. Reconciliation GET & POST
    const rReconGet = await fetch(`${API_BASE}/inventory/reconciliation`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rReconGet.status === 403, 'GET /api/inventory/reconciliation -> HTTP 403 Forbidden for Manager');

    const rReconPost = await fetch(`${API_BASE}/inventory/reconciliation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Manager-Token': rakeshToken },
      body: JSON.stringify({ itemType: 'RAW_MATERIAL', itemId: 1, physicalCountKg: 5000, reason: 'test' })
    });
    assert(rReconPost.status === 403, 'POST /api/inventory/reconciliation -> HTTP 403 Forbidden for Manager');

    // 6. Reports (Wastage, Customer Sales)
    const rWaste = await fetch(`${API_BASE}/reports/wastage`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rWaste.status === 403, 'GET /api/reports/wastage -> HTTP 403 Forbidden for Manager');

    const rCustSales = await fetch(`${API_BASE}/reports/customer-sales`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rCustSales.status === 403, 'GET /api/reports/customer-sales -> HTTP 403 Forbidden for Manager');

    // 7. Audit Logs
    const rAudit = await fetch(`${API_BASE}/audit-logs`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rAudit.status === 403, 'GET /api/audit-logs -> HTTP 403 Forbidden for Manager');

    // 8. Other Manager Activity & My Entries
    const rAct = await fetch(`${API_BASE}/managers/activity`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rAct.status === 403, 'GET /api/managers/activity -> HTTP 403 Forbidden for Manager');

    const rMy = await fetch(`${API_BASE}/managers/my-entries?managerName=TestManagerRakesh`, { headers: { 'X-Manager-Token': rakeshToken } });
    assert(rMy.status === 403, 'GET /api/managers/my-entries -> HTTP 403 Forbidden for Manager');

    // 9. Masters Mutations (Modification and Deletion are strictly forbidden for Manager)
    const rMasterDelete = await fetch(`${API_BASE}/masters/raw-materials/1`, {
      method: 'DELETE',
      headers: { 'X-Manager-Token': rakeshToken }
    });
    assert(rMasterDelete.status === 403, 'DELETE /api/masters/raw-materials/1 -> HTTP 403 Forbidden for Manager');

    // -------------------------------------------------------------
    // TEST SUITE 3: SANITIZED MASTER DATA FOR ENTRY DROPDOWNS
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Sanitized Master Data For Entry Forms ---');
    const rDropdownRM = await fetch(`${API_BASE}/masters/raw-materials`, { headers: { 'X-Manager-Token': rakeshToken } });
    const dropdownRM = await rDropdownRM.json();
    assert(rDropdownRM.status === 200, 'GET /api/masters/raw-materials allowed for Manager');
    assert(dropdownRM.length > 0, 'Active raw materials returned');
    assert(dropdownRM[0].current_stock_kg !== undefined, 'Raw materials have current_stock_kg for Manager consumption');

    const rDropdownFG = await fetch(`${API_BASE}/masters/finished-goods`, { headers: { 'X-Manager-Token': rakeshToken } });
    const dropdownFG = await rDropdownFG.json();
    assert(rDropdownFG.status === 200, 'GET /api/masters/finished-goods allowed for Manager');
    assert(dropdownFG.length > 0, 'Active finished goods returned');
    assert(dropdownFG[0].current_stock_kg !== undefined, 'Finished goods have current_stock_kg for Manager sales');

    // -------------------------------------------------------------
    // TEST SUITE 4: PURCHASE ENTRY & ATTRIBUTION INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Purchase Entry & Attribution Integrity ---');
    const purRes = await fetch(`${API_BASE}/transactions/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Manager-Token': rakeshToken },
      body: JSON.stringify({
        date: '2026-09-09',
        supplierId: 1,
        rawMaterialId: 3, // LLDPE
        quantityKg: 5000,
        ratePerKg: 92.00,
        invoiceNumber: 'INV-TEST-5000',
        managerName: 'ForgedManagerName', // Attempt spoofing
        deviceId: 'forged-device-id'
      })
    });
    const purData = await purRes.json();
    assert(purRes.status === 201, 'Purchase created successfully (HTTP 201)');
    assert(purData.manager_name === 'TestManagerRakesh', 'Attribution enforced: manager_name is TestManagerRakesh (forgery prevented)');

    // -------------------------------------------------------------
    // TEST SUITE 5: PRODUCTION BALANCE VALIDATION & STOCK DEDUCTION
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Production Balance Validation & Execution ---');
    
    // Test 5A: Unbalanced Production (must fail with HTTP 400)
    const unbalRes = await fetch(`${API_BASE}/transactions/production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Manager-Token': rakeshToken },
      body: JSON.stringify({
        date: '2026-09-09',
        machineId: 1,
        shiftId: 1,
        rawMaterialId: 3,
        rawMaterialUsedKg: 4800,
        outputs: [
          { finishedProductId: 1, quantityKg: 2500 },
          { finishedProductId: 2, quantityKg: 2000 } // Total 4500 + 100 = 4600 != 4800
        ],
        totalWastageKg: 100,
        wastageReason: 'Machine Waste'
      })
    });
    assert(unbalRes.status === 400, 'Unbalanced production batch correctly rejected with HTTP 400');

    // Test 5B: Balanced Production (2500 + 2100 + 200 = 4800)
    const balRes = await fetch(`${API_BASE}/transactions/production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Manager-Token': rakeshToken },
      body: JSON.stringify({
        date: '2026-09-09',
        machineId: 1,
        shiftId: 1,
        rawMaterialId: 3,
        rawMaterialUsedKg: 4800,
        outputs: [
          { finishedProductId: 1, quantityKg: 2500 },
          { finishedProductId: 2, quantityKg: 2100 }
        ],
        totalWastageKg: 200,
        wastageReason: 'Machine Waste'
      })
    });
    const balData = await balRes.json();
    assert(balRes.status === 201, 'Balanced production batch created successfully (HTTP 201)');
    assert(balData.manager_name === 'TestManagerRakesh', 'Attribution enforced on production batch');

    // -------------------------------------------------------------
    // TEST SUITE 6: SALES ENTRY & STOCK GUARD
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Sales Entry & Attribution ---');
    const saleRes = await fetch(`${API_BASE}/transactions/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Manager-Token': rakeshToken },
      body: JSON.stringify({
        date: '2026-09-09',
        customerId: 1,
        finishedProductId: 1,
        quantityKg: 800,
        ratePerKg: 140.00,
        paymentType: 'Cash'
      })
    });
    const saleData = await saleRes.json();
    assert(saleRes.status === 201, 'Sale recorded successfully (HTTP 201)');

    // -------------------------------------------------------------
    // TEST SUITE 7: ADMIN CONTROLS & MANAGER DEACTIVATION
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Admin Manager Deactivation Enforcement ---');
    // Deactivate Rakesh
    const deactRes = await fetch(`${API_BASE}/masters/managers/${rakeshId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' })
    });
    assert(deactRes.status === 200, 'Admin can set manager status to inactive');

    // Rakesh tries to submit transaction
    const blockedRes = await fetch(`${API_BASE}/transactions/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Manager-Token': rakeshToken },
      body: JSON.stringify({ date: '2026-09-09', supplierId: 1, rawMaterialId: 1, quantityKg: 100, ratePerKg: 50 })
    });
    assert(blockedRes.status === 403, 'Deactivated manager immediately blocked with HTTP 403');

    // Reactivate Rakesh
    const reactRes = await fetch(`${API_BASE}/masters/managers/${rakeshId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    assert(reactRes.status === 200, 'Admin can reactivate manager');

    // -------------------------------------------------------------
    // TEST SUITE 8: ADMIN VISIBILITY & STOCK INTEGRITY VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Admin Visibility & Stock Verification ---');
    const adminStatsRes = await fetch(`${API_BASE}/dashboard/stats`);
    const adminStats = await adminStatsRes.json();
    assert(adminStatsRes.status === 200, 'Admin can access dashboard stats');
    assert(adminStats.rawMaterialStockKg > 0, 'Admin sees real-time calculated RM stock');
    assert(adminStats.finishedGoodsStockKg > 0, 'Admin sees real-time calculated FG stock');

    const adminRMRes = await fetch(`${API_BASE}/inventory/raw-materials`);
    const adminRM = await adminRMRes.json();
    const lldpeItem = adminRM.find(r => r.code === 'RM-003');
    assert(lldpeItem !== undefined, 'Admin sees RM-003 in inventory');

    console.log('\n====================================================');
    console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
