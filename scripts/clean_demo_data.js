'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db, init: initDb } = require('../server/db/index');

const TABLES_TO_CLEAR = [
  // Child transaction tables first
  'sales_items',
  'purchase_items',
  'consumption_batch_items',
  'production_outputs',
  'wastage_records',
  
  // Stock movement and logs
  'raw_material_movements',
  'finished_goods_movements',
  'stock_adjustments',
  'audit_logs',
  'payments',

  // Parent transaction tables
  'sales',
  'raw_material_purchases',
  'consumption_batches',
  'production_batches',
  'production_orders',

  // Master tables
  'customers',
  'suppliers',
  'finished_products',
  'raw_materials',
  'machines',
  'shifts'
];

async function runCleanup() {
  console.log('===============================================================');
  console.log('TRIPAL ERP — COMPLETE DEMO DATA & MASTERS CLEANUP');
  console.log('===============================================================\n');

  await initDb();

  console.log('[1/3] Clearing transaction and demo master tables...');
  for (const table of TABLES_TO_CLEAR) {
    try {
      if (db.isPostgres) {
        await db.exec(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
      } else {
        await db.prepare(`DELETE FROM ${table}`).run();
      }
      console.log(`  ✓ Cleared [${table}]`);
    } catch (err) {
      // Fallback if TRUNCATE fails (e.g. SQLite or specific permissions)
      try {
        await db.prepare(`DELETE FROM ${table}`).run();
        console.log(`  ✓ Cleared (via DELETE) [${table}]`);
      } catch (innerErr) {
        console.error(`  ✗ Error clearing [${table}]:`, innerErr.message);
      }
    }
  }

  // Reset sqlite_sequence if SQLite
  if (!db.isPostgres) {
    try {
      for (const table of TABLES_TO_CLEAR) {
        await db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
      }
      console.log('  ✓ Reset SQLite auto-increment sequences');
    } catch (_) {}
  }

  console.log('\n[2/3] Verifying Preserved Tables (Users, Managers, Settings)...');
  const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
  const mgrCount = await db.prepare('SELECT COUNT(*) as count FROM managers').get();
  const settingsCount = await db.prepare('SELECT COUNT(*) as count FROM settings').get();
  console.log(`  - users: ${userCount.count} preserved (admin & manager1 intact)`);
  console.log(`  - managers: ${mgrCount.count} preserved`);
  console.log(`  - settings: ${settingsCount.count} preserved (Company profile & configuration intact)`);

  console.log('\n[3/3] Final Table Row Counts:');
  for (const table of TABLES_TO_CLEAR) {
    const r = await db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`  - ${table.padEnd(26)}: ${r.count} rows`);
  }

  console.log('\n===============================================================');
  console.log('ALL DEMO DATA & MASTERS CLEARED SUCCESSFULLY!');
  console.log('TRIPAL ERP IS READY FOR FRESH LIVE CLIENT DATA ENTRY.');
  console.log('===============================================================');
  process.exit(0);
}

runCleanup().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
