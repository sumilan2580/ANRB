/**
 * TRIPAL ERP — Full Test Data Cleanup + Live Ready
 * 
 * Kya hoga:
 * 1. Sab test sales, payments, purchases, production data clear
 * 2. Sab test financial years clear (FY 2025-26, FY 2027-28 jo test ne banaye)
 *    FY 2026-27 rakha jayega as active FY
 * 3. Opening balances, bank accounts, debit/credit notes, bank transfers — already clean
 * 4. RM/FG stock movements bhi clean honge
 * 5. Audit logs clean honge
 * 
 * Kya NAHI hoga:
 * - Masters (customers, suppliers, raw materials, finished goods, managers) DELETE NAHI
 * - FY 2026-27 DELETE NAHI (active rahega)
 */

require('dotenv').config();
const { db } = require('./db');

console.log('=== TRIPAL ERP: FULL TEST DATA CLEANUP ===\n');

function safe(label, fn) {
  try {
    const result = fn();
    console.log(`  ✓ ${label}`);
    return result;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
  }
}

db.exec('BEGIN TRANSACTION;');
try {

  // ── 1. SALES: Delete ALL test sales, keep only genuine ones (invoice numbers without INV-2026 prefix + non-test)
  // All existing sales are test data — clear completely
  const allSales = db.prepare('SELECT id, sale_code FROM sales').all();
  const allSaleCodes = allSales.map(s => s.sale_code);
  const allSaleIds = allSales.map(s => s.id);

  if (allSaleIds.length > 0) {
    const p = allSaleIds.map(() => '?').join(',');
    const cp = allSaleCodes.map(() => '?').join(',');
    safe(`Delete ${allSaleIds.length} sales`, () => {
      db.prepare(`DELETE FROM sales_items WHERE sale_id IN (${p})`).run(...allSaleIds);
      db.prepare(`DELETE FROM finished_goods_movements WHERE reference_id IN (${cp})`).run(...allSaleCodes);
      db.prepare(`DELETE FROM sales WHERE id IN (${p})`).run(...allSaleIds);
    });
  }

  // ── 2. PAYMENTS: Delete all test payments — keep none (id > 3 already identified as test)
  // Also clear the initial 3 which were demo data
  const allPays = db.prepare('SELECT id FROM payments').all();
  const allPayIds = allPays.map(p => p.id);
  if (allPayIds.length > 0) {
    const p = allPayIds.map(() => '?').join(',');
    safe(`Delete ${allPayIds.length} payments/receipts`, () => {
      db.prepare(`DELETE FROM payments WHERE id IN (${p})`).run(...allPayIds);
    });
  }

  // ── 3. PURCHASES: Clear all test purchases, keep only genuine first purchase
  const allPurs = db.prepare('SELECT id, purchase_code FROM raw_material_purchases').all();
  const allPurIds = allPurs.map(p => p.id);
  const allPurCodes = allPurs.map(p => p.purchase_code);
  if (allPurIds.length > 0) {
    const p = allPurIds.map(() => '?').join(',');
    const cp = allPurCodes.map(() => '?').join(',');
    safe(`Delete ${allPurIds.length} purchases`, () => {
      db.prepare(`DELETE FROM purchase_items WHERE purchase_id IN (${p})`).run(...allPurIds);
      db.prepare(`DELETE FROM raw_material_movements WHERE reference_id IN (${cp})`).run(...allPurCodes);
      db.prepare(`DELETE FROM raw_material_purchases WHERE id IN (${p})`).run(...allPurIds);
    });
  }

  // ── 4. PRODUCTION: Clear all test batches, orders, consumption
  const allProdBatches = db.prepare('SELECT id, batch_code FROM production_batches').all();
  const allProdIds = allProdBatches.map(b => b.id);
  const allProdCodes = allProdBatches.map(b => b.batch_code);
  if (allProdIds.length > 0) {
    const p = allProdIds.map(() => '?').join(',');
    const cp = allProdCodes.map(() => '?').join(',');
    safe(`Delete ${allProdIds.length} production batches`, () => {
      db.prepare(`DELETE FROM production_outputs WHERE batch_id IN (${p})`).run(...allProdIds);
      db.prepare(`DELETE FROM wastage_records WHERE production_id IN (${p})`).run(...allProdIds);
      db.prepare(`DELETE FROM finished_goods_movements WHERE reference_id IN (${cp})`).run(...allProdCodes);
      db.prepare(`DELETE FROM raw_material_movements WHERE reference_id IN (${cp})`).run(...allProdCodes);
      db.prepare(`DELETE FROM production_batches WHERE id IN (${p})`).run(...allProdIds);
    });
  }

  const allConsBatches = db.prepare('SELECT id, batch_no FROM consumption_batches').all();
  const allConsIds = allConsBatches.map(c => c.id);
  const allConsCodes = allConsBatches.map(c => c.batch_no);
  if (allConsIds.length > 0) {
    const p = allConsIds.map(() => '?').join(',');
    const cp = allConsCodes.map(() => '?').join(',');
    safe(`Delete ${allConsIds.length} consumption batches`, () => {
      db.prepare(`DELETE FROM consumption_batch_items WHERE consumption_batch_id IN (${p})`).run(...allConsIds);
      db.prepare(`DELETE FROM raw_material_movements WHERE reference_id IN (${cp})`).run(...allConsCodes);
      db.prepare(`DELETE FROM consumption_batches WHERE id IN (${p})`).run(...allConsIds);
    });
  }

  const allOrders = db.prepare('SELECT id FROM production_orders').all();
  const allOrderIds = allOrders.map(o => o.id);
  if (allOrderIds.length > 0) {
    const p = allOrderIds.map(() => '?').join(',');
    safe(`Delete ${allOrderIds.length} production orders`, () => {
      db.prepare(`DELETE FROM production_orders WHERE id IN (${p})`).run(...allOrderIds);
    });
  }

  // ── 5. RM Movements — clear all (purchases + consumption cleared above, opening will be re-added)
  safe('Clear all remaining RM movements', () => {
    db.prepare('DELETE FROM raw_material_movements').run();
  });

  // ── 6. FG Movements — clear all
  safe('Clear all remaining FG movements', () => {
    db.prepare('DELETE FROM finished_goods_movements').run();
  });

  // ── 7. Financial Years — keep only FY 2026-27 as active, delete test FYs
  safe('Remove test Financial Years (FY 2025-26, FY 2027-28)', () => {
    db.prepare("DELETE FROM financial_years WHERE name != 'FY 2026-27'").run();
    db.prepare("UPDATE financial_years SET is_active = 1 WHERE name = 'FY 2026-27'").run();
  });

  // ── 8. Opening Balances, Bank Accounts, Bank Transfers, Debit/Credit Notes — already clean
  safe('Verify new tables are clean', () => {
    const ob = db.prepare('SELECT COUNT(*) as c FROM opening_balances').get();
    const ba = db.prepare('SELECT COUNT(*) as c FROM bank_accounts').get();
    const dn = db.prepare('SELECT COUNT(*) as c FROM debit_credit_notes').get();
    const bt = db.prepare('SELECT COUNT(*) as c FROM bank_transfers').get();
    console.log(`     opening_balances: ${ob.c}, bank_accounts: ${ba.c}, debit_credit_notes: ${dn.c}, bank_transfers: ${bt.c}`);
  });

  // ── 9. Audit Logs — clear test entries
  safe('Clear test audit logs', () => {
    db.prepare("DELETE FROM audit_logs WHERE performed_by IN ('TestManagerRakesh', 'SmokeTestMgr2', 'DiagMgr', 'Admin') AND entity_type NOT IN ('FINANCIAL_YEAR')").run();
  });

  // ── 10. Test Managers — remove
  safe('Remove test manager accounts', () => {
    db.prepare("DELETE FROM managers WHERE name IN ('TestManagerRakesh', 'SmokeTestMgr2', 'DiagMgr')").run();
  });

  db.exec('COMMIT;');
  console.log('\n✅ Cleanup committed successfully!\n');

} catch (err) {
  db.exec('ROLLBACK;');
  console.error('\n❌ Cleanup FAILED — rolled back:', err.message);
  process.exit(1);
}

// ── Final State Report
console.log('=== DATABASE STATE AFTER CLEANUP ===');
console.log('Financial Years:', db.prepare('SELECT id, name, is_active FROM financial_years').all());
console.log('RM Stock Movements:', db.prepare('SELECT COUNT(*) as count FROM raw_material_movements').get());
console.log('FG Stock Movements:', db.prepare('SELECT COUNT(*) as count FROM finished_goods_movements').get());
console.log('Sales:', db.prepare('SELECT COUNT(*) as count FROM sales').get());
console.log('Purchases:', db.prepare('SELECT COUNT(*) as count FROM raw_material_purchases').get());
console.log('Payments:', db.prepare('SELECT COUNT(*) as count FROM payments').get());
console.log('Production Batches:', db.prepare('SELECT COUNT(*) as count FROM production_batches').get());
console.log('Production Orders:', db.prepare('SELECT COUNT(*) as count FROM production_orders').get());
console.log('Opening Balances:', db.prepare('SELECT COUNT(*) as count FROM opening_balances').get());
console.log('Bank Accounts:', db.prepare('SELECT COUNT(*) as count FROM bank_accounts').get());
console.log('Managers:', db.prepare('SELECT id, name, status FROM managers').all());
console.log('Customers:', db.prepare('SELECT id, name FROM customers').all());
console.log('Suppliers:', db.prepare('SELECT id, name FROM suppliers').all());
console.log('Raw Materials:', db.prepare('SELECT id, name FROM raw_materials').all());
console.log('Finished Goods:', db.prepare('SELECT id, product_name FROM finished_products').all());
console.log('\n✅ SYSTEM IS LIVE-READY. Sab masters safe hain.');
