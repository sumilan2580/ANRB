const { db } = require('./db');

console.log('=== TRIPAL ERP DEMO / TEST DATA CLEANUP ===');

function runTransaction(callback) {
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = callback();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

const run = () => {
  runTransaction(() => {
    // 1. Identify Test Sales (keep only genuine SALE-000001)
    const testSales = db.prepare(`
      SELECT id, sale_code, invoice_number, total_amount, manager_name 
      FROM sales 
      WHERE id > 1 OR manager_name = 'TestManagerRakesh'
    `).all();
    console.log(`Found ${testSales.length} test sales to remove.`);

    const testSaleIds = testSales.map(s => s.id);
    const testSaleCodes = testSales.map(s => s.sale_code);

    if (testSaleIds.length > 0) {
      const placeholders = testSaleIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM sales_items WHERE sale_id IN (${placeholders})`).run(...testSaleIds);
      
      const codePlaceholders = testSaleCodes.map(() => '?').join(',');
      db.prepare(`DELETE FROM finished_goods_movements WHERE reference_id IN (${codePlaceholders}) OR remarks LIKE '%test%'`).run(...testSaleCodes);
      
      db.prepare(`DELETE FROM sales WHERE id IN (${placeholders})`).run(...testSaleIds);
    }

    // 2. Identify Test Purchases (keep genuine initial purchases: 1, 2, 3, 5)
    const testPurchases = db.prepare(`
      SELECT id, purchase_code, invoice_number, total_amount, manager_name 
      FROM raw_material_purchases 
      WHERE id NOT IN (1, 2, 3, 5)
    `).all();
    console.log(`Found ${testPurchases.length} test purchases to remove.`);

    const testPurIds = testPurchases.map(p => p.id);
    const testPurCodes = testPurchases.map(p => p.purchase_code);

    if (testPurIds.length > 0) {
      const placeholders = testPurIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM purchase_items WHERE purchase_id IN (${placeholders})`).run(...testPurIds);

      const codePlaceholders = testPurCodes.map(() => '?').join(',');
      db.prepare(`DELETE FROM raw_material_movements WHERE reference_id IN (${codePlaceholders}) OR reference_type IN ('PURCHASE_EDIT_REVERSAL')`).run(...testPurCodes);

      db.prepare(`DELETE FROM raw_material_purchases WHERE id IN (${placeholders})`).run(...testPurIds);
    }

    // 3. Identify Test Production Batches (keep initial PROD-000001)
    const testProdBatches = db.prepare(`
      SELECT id, batch_code FROM production_batches WHERE id > 1
    `).all();
    console.log(`Found ${testProdBatches.length} test production batches to remove.`);
    const testProdIds = testProdBatches.map(b => b.id);
    const testProdCodes = testProdBatches.map(b => b.batch_code);

    if (testProdIds.length > 0) {
      const placeholders = testProdIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM production_outputs WHERE batch_id IN (${placeholders})`).run(...testProdIds);
      db.prepare(`DELETE FROM wastage_records WHERE production_id IN (${placeholders})`).run(...testProdIds);
      
      const codePlaceholders = testProdCodes.map(() => '?').join(',');
      db.prepare(`DELETE FROM finished_goods_movements WHERE reference_id IN (${codePlaceholders})`).run(...testProdCodes);
      db.prepare(`DELETE FROM raw_material_movements WHERE reference_id IN (${codePlaceholders})`).run(...testProdCodes);

      db.prepare(`DELETE FROM production_batches WHERE id IN (${placeholders})`).run(...testProdIds);
    }

    // 4. Identify Test Consumption Batches (keep initial CB-000001, CB-000002, CB-000003)
    const testConsBatches = db.prepare(`
      SELECT id, batch_no FROM consumption_batches WHERE id > 3
    `).all();
    console.log(`Found ${testConsBatches.length} test consumption batches to remove.`);
    const testConsIds = testConsBatches.map(c => c.id);
    const testConsCodes = testConsBatches.map(c => c.batch_no);

    if (testConsIds.length > 0) {
      const placeholders = testConsIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM consumption_batch_items WHERE consumption_batch_id IN (${placeholders})`).run(...testConsIds);

      const codePlaceholders = testConsCodes.map(() => '?').join(',');
      db.prepare(`DELETE FROM raw_material_movements WHERE reference_id IN (${codePlaceholders})`).run(...testConsCodes);

      db.prepare(`DELETE FROM consumption_batches WHERE id IN (${placeholders})`).run(...testConsIds);
    }

    // 5. Identify Test Production Orders (keep initial PO-000001, PO-000002, PO-000003)
    const testOrders = db.prepare(`
      SELECT id, order_no FROM production_orders WHERE id > 3
    `).all();
    console.log(`Found ${testOrders.length} test production orders to remove.`);
    const testOrderIds = testOrders.map(o => o.id);
    if (testOrderIds.length > 0) {
      const placeholders = testOrderIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM production_orders WHERE id IN (${placeholders})`).run(...testOrderIds);
    }

    // 6. Identify Test Payments
    const testPayments = db.prepare(`
      SELECT id, payment_code, manager_name, remarks 
      FROM payments 
      WHERE manager_name = 'TestManagerRakesh' 
         OR remarks LIKE '%Immediate receipt for sale%'
         OR remarks LIKE '%Immediate purchase payment%'
         OR remarks LIKE '%TEST%'
         OR id > 3
    `).all();
    console.log(`Found ${testPayments.length} test payments to remove.`);
    const testPayIds = testPayments.map(p => p.id);
    if (testPayIds.length > 0) {
      const placeholders = testPayIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM payments WHERE id IN (${placeholders})`).run(...testPayIds);
    }

    // 7. Remove Test Managers
    const testManagers = db.prepare(`
      SELECT id, name FROM managers WHERE name IN ('TestManagerRakesh', 'SmokeTestMgr2', 'DiagMgr')
    `).all();
    console.log(`Found ${testManagers.length} test manager accounts to remove.`);
    for (const m of testManagers) {
      db.prepare(`DELETE FROM managers WHERE id = ?`).run(m.id);
    }

    // Clean up audit logs for test records
    db.prepare(`DELETE FROM audit_logs WHERE performed_by IN ('TestManagerRakesh', 'SmokeTestMgr2', 'DiagMgr')`).run();

    console.log('Cleanup completed successfully in transaction.');
  });
};

run();

// Verify current master and transaction state
console.log('\n=== CURRENT DATABASE STATE AFTER CLEANUP ===');
console.log('Managers:', db.prepare('SELECT id, name, status FROM managers').all());
console.log('Purchases:', db.prepare('SELECT id, purchase_code, total_amount, invoice_number, manager_name FROM raw_material_purchases').all());
console.log('Sales:', db.prepare('SELECT id, sale_code, invoice_number, total_amount, manager_name FROM sales').all());
console.log('Production Orders:', db.prepare('SELECT id, order_no, status FROM production_orders').all());
console.log('Consumption Batches:', db.prepare('SELECT id, batch_no, status FROM consumption_batches').all());
console.log('Production Batches:', db.prepare('SELECT id, batch_code, total_finished_kg FROM production_batches').all());
console.log('Payments:', db.prepare('SELECT id, payment_code, party_type, amount, payment_mode FROM payments').all());
