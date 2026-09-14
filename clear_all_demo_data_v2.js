/**
 * clear_all_demo_data_v2.js
 * -------------------------------------------------------
 * Clears ALL remaining transaction/demo data.
 * PRESERVES: customers, suppliers, raw_materials, finished_products,
 *            machines, shifts, settings, users
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'tripal_erp.sqlite');
const backupPath = dbPath + '.backup_v2_' + Date.now();

fs.copyFileSync(dbPath, backupPath);
console.log('Backup created:', backupPath);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN TRANSACTION;');

try {
  const txTables = [
    'audit_logs',
    'raw_material_movements',
    'finished_goods_movements',
    'wastage_records',
    'stock_adjustments',
    'sales_items',
    'sales',
    'production_outputs',
    'production_orders',
    'production_batches',
    'consumption_batch_items',
    'consumption_batches',
    'purchase_items',
    'raw_material_purchases',
    'payments',
    'managers',
  ];

  for (const t of txTables) {
    try {
      const res = db.prepare('DELETE FROM ' + t).run();
      console.log('  Cleared: ' + t + ' (' + res.changes + ' rows)');
    } catch (e) {
      console.log('  SKIP ' + t + ': ' + e.message);
    }
  }

  // Reset auto-increment counters
  for (const t of txTables) {
    try {
      db.prepare("DELETE FROM sqlite_sequence WHERE name=?").run(t);
    } catch (_) {}
  }

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('\n======================================================');
  console.log('  ALL DEMO DATA CLEARED SUCCESSFULLY');
  console.log('======================================================');
  console.log('\n--- Final row counts ---');

  const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  for (const t of allTables) {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
    console.log('  ' + t.name + ': ' + cnt.c);
  }

  db.close();
  process.exit(0);
} catch (err) {
  db.exec('ROLLBACK;');
  db.close();
  console.error('ERROR - rollback:', err.message);
  process.exit(1);
}
