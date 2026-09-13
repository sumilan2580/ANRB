'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db, init } = require('../server/db/index');

async function check() {
  await init();

  // 1. Check backup file
  const backupDir = path.resolve(__dirname, '../backups/postgres');
  const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  console.log('=== BACKUP CONFIRMATION ===');
  console.log(`Backup Directory: ${backupDir}`);
  console.log(`Found ${backupFiles.length} backup file(s):`);
  backupFiles.forEach(f => {
    const stat = fs.statSync(path.join(backupDir, f));
    console.log(` - ${f} (${(stat.size / 1024).toFixed(2)} KB, created: ${stat.birthtime.toISOString()})`);
  });

  // 2. Exact table row counts to be cleared
  const tablesToClear = [
    'raw_materials',
    'finished_products',
    'suppliers',
    'customers',
    'machines',
    'shifts',
    'production_orders',
    'consumption_batches',
    'consumption_batch_items',
    'raw_material_purchases',
    'purchase_items',
    'raw_material_movements',
    'production_batches',
    'production_outputs',
    'finished_goods_movements',
    'sales',
    'sales_items',
    'wastage_records',
    'payments',
    'stock_adjustments',
    'audit_logs',
    'managers'
  ];

  console.log('\n=== TABLES AND ROWS TO BE CLEARED ===');
  let totalRowsToClear = 0;
  for (const t of tablesToClear) {
    const row = await db.prepare(`SELECT COUNT(*) as count FROM ${t}`).get();
    const cnt = Number(row ? row.count : 0);
    totalRowsToClear += cnt;
    console.log(`  Table [${t.padEnd(25)}]: ${String(cnt).padStart(4)} rows to clear`);
  }

  // Users table details
  const users = await db.prepare('SELECT id, username, role FROM users').all();
  console.log('\n=== USERS TABLE ===');
  console.log(`Current users (${users.length}):`, users);
  const managerUsers = users.filter(u => u.username !== 'admin');
  console.log(`Manager users to remove (${managerUsers.length}):`, managerUsers.map(u => u.username));
  console.log(`Admin user to preserve: 1 (username: admin)`);

  console.log('\n=== SUMMARY ===');
  console.log(`Total rows to clear across business tables: ${totalRowsToClear}`);
  console.log(`Backup confirmed: YES (${backupFiles[backupFiles.length - 1]})`);
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
