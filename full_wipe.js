/**
 * full_wipe.js
 * -------------------------------------------------------
 * Wipes ALL data from Tripal ERP.
 * PRESERVES: settings (company info), users (admin login)
 * CLEARS:    ALL masters + ALL transactions + managers
 *
 * Run from project root: node full_wipe.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'tripal_erp.sqlite');
const backupPath = dbPath + '.fullwipe_backup_' + Date.now();

fs.copyFileSync(dbPath, backupPath);
console.log('Backup saved:', backupPath);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN TRANSACTION;');

try {
  const tablesToClear = [
    // Transactions
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
    // Masters
    'managers',
    'customers',
    'suppliers',
    'finished_products',
    'raw_materials',
    'machines',
    'shifts',
  ];

  for (const t of tablesToClear) {
    try {
      const res = db.prepare('DELETE FROM ' + t).run();
      console.log('  Cleared: ' + t + ' (' + res.changes + ' rows deleted)');
    } catch (e) {
      console.log('  SKIP ' + t + ': ' + e.message);
    }
  }

  // Reset all auto-increment counters
  db.exec("DELETE FROM sqlite_sequence;");
  console.log('  Reset: sqlite_sequence (all auto-increment counters)');

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('\n======================================================');
  console.log('  FULL WIPE COMPLETE — DATABASE IS NOW EMPTY');
  console.log('======================================================');
  console.log('\n--- Final row counts ---');

  const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  for (const t of allTables) {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
    const marker = cnt.c > 0 ? ' <-- preserved' : '';
    console.log('  ' + t.name + ': ' + cnt.c + marker);
  }

  db.close();
  console.log('\nDone. Backup at:', backupPath);
  process.exit(0);
} catch (err) {
  db.exec('ROLLBACK;');
  db.close();
  console.error('ERROR - rollback performed:', err.message);
  process.exit(1);
}
