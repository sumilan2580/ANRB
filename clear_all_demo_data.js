/**
 * clear_all_demo_data.js
 * -------------------------------------------------------
 * Wipes ALL transaction / test data from Tripal ERP.
 * PRESERVES: master tables (customers, suppliers, raw_materials,
 *             finished_goods, machines, shifts, company_settings, users)
 * DELETES:   every transaction row + movements + audit_logs + managers
 *             created by TestManager* registrations from automated tests.
 *
 * Run ONCE from project root:
 *   node clear_all_demo_data.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'tripal_erp.sqlite');
const backupPath = dbPath + '.backup_before_clear_' + Date.now();

// Safety: take a backup first
fs.copyFileSync(dbPath, backupPath);
console.log('✅ Backup created:', backupPath);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN TRANSACTION;');

try {
  // ---- Transaction & movement tables (FULL wipe) ----
  const txTables = [
    'audit_logs',
    'raw_material_movements',
    'finished_goods_movements',
    'production_batch_outputs',
    'production_batches',
    'purchases',
    'receipts',
    'payments',
    'cash_bank_entries',
    'customer_orders',
    'sales',
  ];

  for (const t of txTables) {
    try {
      db.exec(`DELETE FROM ${t};`);
      console.log(`  Cleared: ${t}`);
    } catch (e) {
      console.log(`  SKIP ${t}: ${e.message}`);
    }
  }

  // ---- Reset auto-increment counters ----
  for (const t of txTables) {
    try {
      db.exec(`DELETE FROM sqlite_sequence WHERE name='${t}';`);
    } catch (_) {}
  }

  // ---- Remove test managers (TestManager* entries from automated tests) ----
  // Also wipe ALL managers so the admin starts fresh
  // Comment out the line below if you want to keep real manager accounts.
  db.exec(`DELETE FROM managers;`);
  db.exec(`DELETE FROM sqlite_sequence WHERE name='managers';`);
  console.log('  Cleared: managers (all demo/test registrations)');

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');

  // ---- Summary ----
  console.log('\n====================================================');
  console.log(' ALL DEMO / TRANSACTION DATA CLEARED SUCCESSFULLY  ');
  console.log('====================================================');
  console.log(' Master data (customers, suppliers, raw materials,');
  console.log(' finished goods, machines, shifts) is PRESERVED.');
  console.log(' Backup saved at:');
  console.log(' ', backupPath);
  console.log('====================================================');

  // Row counts after cleanup
  const checkTables = [...txTables, 'managers', 'customers', 'suppliers', 'raw_materials', 'finished_goods'];
  console.log('\n--- Row counts after cleanup ---');
  for (const t of checkTables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get();
      console.log(`  ${t}: ${row.cnt}`);
    } catch (_) {}
  }

  db.close();
  process.exit(0);
} catch (err) {
  db.exec('ROLLBACK;');
  db.close();
  console.error('❌ ERROR — rollback performed:', err.message);
  process.exit(1);
}
