'use strict';

/**
 * TRIPAL ERP — Automated PostgreSQL Backup System
 *
 * Usage:
 *   npm run backup
 *   (or) node scripts/backup-postgres.js
 *
 * Features:
 *   - Automatically creates `backups/postgres/` directory
 *   - Dumps complete database in structured JSON format
 *   - Creates timestamped backup files: `tripal_backup_YYYYMMDD_HHMMSS.json`
 *   - Never overwrites previous backups
 *   - Never exposes database passwords in logs or files
 *   - Works independently of pg_dump (runs anywhere on Windows/Linux via Node driver)
 *   - Provides disaster recovery external to Layerbase
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ERP_TABLES = [
  'users',
  'managers',
  'raw_materials',
  'suppliers',
  'customers',
  'machines',
  'shifts',
  'finished_products',
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
  'settings'
];

async function runBackup() {
  console.log('===============================================================');
  console.log('TRIPAL ERP — Layerbase PostgreSQL External Backup Tool');
  console.log('===============================================================\n');

  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const isSsl = process.env.PGSSL !== 'false' && process.env.PGSSL !== '0';

  if (!connectionString && (!host || !user || !database)) {
    console.error('❌ Error: Layerbase PostgreSQL credentials missing in .env');
    console.error('Please configure DATABASE_URL or PGHOST, PGUSER, PGDATABASE.');
    process.exit(1);
  }

  const poolConfig = connectionString
    ? { connectionString, ssl: isSsl ? { rejectUnauthorized: false } : false }
    : { host, port, database, user, password, ssl: isSsl ? { rejectUnauthorized: false } : false };

  // Ensure backup directory exists
  const backupDir = path.resolve(__dirname, '../backups/postgres');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`[Backup] Created backup directory: ${backupDir}`);
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const filename = `tripal_backup_${timestamp}.json`;
  const backupFilePath = path.join(backupDir, filename);

  const pool = new Pool(poolConfig);
  let client;

  try {
    client = await pool.connect();
    console.log('[Backup] Connected to Layerbase PostgreSQL.');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      formatVersion: '1.0',
      database: database || 'Layerbase PostgreSQL',
      tables: {}
    },
    tables: {}
  };

  let totalRows = 0;

  try {
    for (const tableName of ERP_TABLES) {
      // Check if table exists
      const existCheck = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      if (existCheck.rows.length === 0) {
        console.log(`  Table [${tableName}]: not present in database`);
        continue;
      }

      // Export rows
      const res = await client.query(`SELECT * FROM ${tableName} ORDER BY 1 ASC`);
      backupData.tables[tableName] = res.rows;
      backupData.metadata.tables[tableName] = res.rows.length;
      totalRows += res.rows.length;

      console.log(`  Table [${tableName}]: ${res.rows.length} rows exported`);
    }

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    const stats = fs.statSync(backupFilePath);
    const sizeKb = (stats.size / 1024).toFixed(2);

    console.log('\n===============================================================');
    console.log(`✅ BACKUP COMPLETED SUCCESSFULLY!`);
    console.log(`File:       ${filename}`);
    console.log(`Location:   ${backupFilePath}`);
    console.log(`Size:       ${sizeKb} KB`);
    console.log(`Total Rows: ${totalRows}`);
    console.log('===============================================================');
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup().catch(err => {
  console.error('Fatal backup error:', err.message);
  process.exit(1);
});
