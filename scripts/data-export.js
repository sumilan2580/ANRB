'use strict';

/**
 * TRIPAL ERP — Data Export & Disaster Recovery Script
 * 
 * Exports all 24 database tables to structured JSON files for:
 *   - Offline archival
 *   - Disaster recovery
 *   - Independent data audits
 * 
 * Works with both Oracle and SQLite backends via server/db/index.js.
 * 
 * Usage:
 *   node scripts/data-export.js [destination_folder]
 */

const path = require('path');
const fs = require('fs');
const { db, init: initDb, close: closeDb } = require('../server/db/index');

const TABLES = [
  'users', 'managers', 'raw_materials', 'suppliers', 'customers',
  'machines', 'shifts', 'finished_products', 'production_orders',
  'consumption_batches', 'consumption_batch_items', 'raw_material_purchases',
  'purchase_items', 'raw_material_movements', 'production_batches',
  'production_outputs', 'finished_goods_movements', 'sales', 'sales_items',
  'wastage_records', 'payments', 'stock_adjustments', 'audit_logs', 'settings'
];

async function exportData() {
  console.log('===============================================================');
  console.log('TRIPAL ERP — DATA EXPORT & DISASTER RECOVERY ARCHIVE');
  console.log('===============================================================\n');

  await initDb();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const customDir = process.argv[2];
  const outDir = customDir
    ? path.resolve(process.cwd(), customDir)
    : path.resolve(__dirname, `../exports/backup_${timestamp}`);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[Export] Output destination directory: ${outDir}\n`);

  const manifest = {
    exportedAt: new Date().toISOString(),
    backend: db.isOracle ? 'Oracle Autonomous Database' : 'SQLite',
    tables: {}
  };

  for (const table of TABLES) {
    try {
      const rows = await db.prepare(`SELECT * FROM ${table}`).all();
      const filePath = path.join(outDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
      manifest.tables[table] = rows.length;
      console.log(`  [PASS] ${table.padEnd(26)}: ${String(rows.length).padStart(5)} rows -> ${table}.json`);
    } catch (err) {
      console.error(`  [FAIL] ${table}: ${err.message}`);
      manifest.tables[table] = { error: err.message };
    }
  }

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n[Export] Manifest written to: manifest.json`);
  console.log(`[Export] Export completed successfully! Total tables: ${TABLES.length}\n`);

  await closeDb();
}

if (require.main === module) {
  exportData().catch(err => {
    console.error('Fatal export error:', err);
    process.exit(1);
  });
}

module.exports = { exportData };
