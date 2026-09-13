'use strict';

/**
 * TRIPAL ERP — SQLite to Oracle Autonomous Database Migration Script
 * 
 * Migrates all 24 tables, rows, relationships, and sequences from SQLite
 * to Oracle Autonomous AI Database Always Free while preserving all primary keys (IDs),
 * timestamps, and financial figures.
 * 
 * Usage:
 *   node scripts/migrate-sqlite-to-oracle.js [--dry-run]
 * 
 * Requirements:
 *   .env must contain ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const oracledb = require('oracledb');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const isDryRun = process.argv.includes('--dry-run');

// Tables in strict foreign-key dependency order
const MIGRATION_TABLES = [
  { name: 'users',                    hasIdentity: true  },
  { name: 'managers',                 hasIdentity: true  },
  { name: 'raw_materials',            hasIdentity: true  },
  { name: 'suppliers',                hasIdentity: true  },
  { name: 'customers',                hasIdentity: true  },
  { name: 'machines',                 hasIdentity: true  },
  { name: 'shifts',                   hasIdentity: true  },
  { name: 'finished_products',        hasIdentity: true  },
  { name: 'production_orders',        hasIdentity: true  },
  { name: 'consumption_batches',      hasIdentity: true  },
  { name: 'consumption_batch_items',  hasIdentity: true  },
  { name: 'raw_material_purchases',   hasIdentity: true  },
  { name: 'purchase_items',           hasIdentity: true  },
  { name: 'raw_material_movements',   hasIdentity: true  },
  { name: 'production_batches',       hasIdentity: true  },
  { name: 'production_outputs',       hasIdentity: true  },
  { name: 'finished_goods_movements', hasIdentity: true  },
  { name: 'sales',                    hasIdentity: true  },
  { name: 'sales_items',              hasIdentity: true  },
  { name: 'wastage_records',          hasIdentity: true  },
  { name: 'payments',                 hasIdentity: true  },
  { name: 'stock_adjustments',        hasIdentity: true  },
  { name: 'audit_logs',               hasIdentity: true  },
  { name: 'settings',                 hasIdentity: false }
];

async function createBackup(sqlitePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(__dirname, `../tripal_erp.sqlite.migration_backup_${timestamp}`);
  fs.copyFileSync(sqlitePath, backupPath);
  console.log(`[Backup] Created safety snapshot: ${path.basename(backupPath)}`);
  return backupPath;
}

function sanitizeValue(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return val;
  }
  return val;
}

async function migrate() {
  console.log('===============================================================');
  console.log('TRIPAL ERP — PRODUCTION MIGRATION: SQLite -> Oracle Autonomous');
  console.log('===============================================================\n');

  if (isDryRun) {
    console.log('*** DRY-RUN MODE: Validating SQLite data without writing to Oracle ***\n');
  }

  // 1. Validate SQLite database
  const sqlitePath = path.resolve(__dirname, '../tripal_erp.sqlite');
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found at: ${sqlitePath}`);
  }

  await createBackup(sqlitePath);
  const sdb = new DatabaseSync(sqlitePath);

  // 2. Validate Oracle environment variables
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;

  if (!isDryRun && (!user || !password || !connectString)) {
    console.error('[Error] Oracle credentials missing in .env:');
    console.error('  Please set ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING');
    console.error('  Refer to .env.example and docs/oracle-migration.md');
    process.exit(1);
  }

  let conn = null;
  if (!isDryRun) {
    console.log(`[Oracle] Connecting to Oracle Autonomous DB as ${user}...`);
    try {
      oracledb.initOracleClient();
    } catch (_) {}

    const connectConfig = {
      user,
      password,
      connectString
    };

    if (process.env.ORACLE_WALLET_LOCATION) {
      connectConfig.walletLocation = process.env.ORACLE_WALLET_LOCATION;
      if (process.env.ORACLE_WALLET_PASSWORD) {
        connectConfig.walletPassword = process.env.ORACLE_WALLET_PASSWORD;
      }
    }

    conn = await oracledb.getConnection(connectConfig);
    console.log('[Oracle] Connected successfully!\n');

    // ── IDEMPOTENCY GUARD ──────────────────────────────────────────────────
    // Check if Oracle tables already have data. If yes, abort immediately
    // to prevent accidentally doubling all records.
    console.log('[Safety] Checking Oracle for pre-existing data...');
    const guardTables = ['users', 'raw_materials', 'sales'];
    const existingCounts = [];
    for (const gt of guardTables) {
      try {
        const gr = await conn.execute(
          `SELECT COUNT(*) AS cnt FROM ${gt}`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const cnt = Number(gr.rows[0].CNT);
        if (cnt > 0) existingCounts.push({ table: gt, count: cnt });
      } catch (_) {
        // Table may not exist yet — that is fine, skip
      }
    }

    if (existingCounts.length > 0) {
      console.error('');
      console.error('[ABORT] Oracle already contains data. Migration aborted to protect existing records.');
      console.error('Existing row counts:');
      for (const ec of existingCounts) {
        console.error(`  ${ec.table}: ${ec.count} rows`);
      }
      console.error('');
      console.error('If you intentionally want to re-migrate, first clear the Oracle schema:');
      console.error('  Run:  node scripts/oracle-schema-create.js --drop-first');
      console.error('  Then: npm run migrate');
      console.error('');
      await conn.close();
      process.exit(1);
    }
    console.log('[Safety] Oracle is empty -- safe to proceed with migration.\n');
    // ── END IDEMPOTENCY GUARD ─────────────────────────────────────────────
  }

  const migrationStats = [];

  // 3. Migrate each table
  for (const tableInfo of MIGRATION_TABLES) {
    const table = tableInfo.name;
    const hasIdentity = tableInfo.hasIdentity;

    let rows = [];
    try {
      rows = sdb.prepare(`SELECT * FROM ${table}`).all();
    } catch (err) {
      console.warn(`[SQLite] Table ${table} not found or query error: ${err.message}`);
      migrationStats.push({ table, sqliteCount: 0, oracleCount: 0, status: 'SKIPPED' });
      continue;
    }

    console.log(`[Migrate] ${table}: Found ${rows.length} rows in SQLite`);

    if (rows.length === 0) {
      migrationStats.push({ table, sqliteCount: 0, oracleCount: 0, status: 'EMPTY' });
      continue;
    }

    if (isDryRun) {
      migrationStats.push({ table, sqliteCount: rows.length, oracleCount: rows.length, status: 'DRY-RUN OK' });
      continue;
    }

    // Insert into Oracle
    const sampleRow = rows[0];
    const columns = Object.keys(sampleRow);
    const colList = columns.join(', ');
    const bindPlaceholders = columns.map((_, i) => `:${i + 1}`).join(', ');

    // For identity columns, Oracle requires OVERRIDING SYSTEM VALUE to allow explicit IDs
    const overridingClause = hasIdentity ? 'OVERRIDING SYSTEM VALUE ' : '';
    const insertSql = `INSERT INTO ${table} ${overridingClause}(${colList}) VALUES (${bindPlaceholders})`;

    let insertedCount = 0;
    for (const r of rows) {
      const bindArray = columns.map(col => {
        let v = sanitizeValue(r[col]);
        // Handle dates/timestamps: if column name includes 'date' or 'created_at' or 'updated_at' or 'voided_at'
        if (v && typeof v === 'string' && (col.includes('date') || col.includes('_at'))) {
          // Keep ISO string or parse to Date object if needed
          const parsed = new Date(v);
          if (!isNaN(parsed.getTime())) {
            return parsed;
          }
        }
        return v;
      });

      try {
        await conn.execute(insertSql, bindArray, { autoCommit: false });
        insertedCount++;
      } catch (insertErr) {
        console.error(`[Error] Insert failed on ${table} (row id: ${r.id || r.key}):`, insertErr.message);
        throw insertErr;
      }
    }

    await conn.commit();
    console.log(`[Migrate] ${table}: Successfully migrated ${insertedCount} rows.`);
    migrationStats.push({ table, sqliteCount: rows.length, oracleCount: insertedCount, status: 'SUCCESS' });

    // Reset sequence/identity counter to MAX(id) + 1
    if (hasIdentity) {
      try {
        const maxRes = await conn.execute(`SELECT NVL(MAX(id), 0) AS max_id FROM ${table}`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const maxId = Number(maxRes.rows[0].MAX_ID || 0);
        if (maxId > 0) {
          // Restart identity column at maxId + 1
          await conn.execute(`ALTER TABLE ${table} MODIFY id GENERATED ALWAYS AS IDENTITY (START WITH ${maxId + 1})`);
          console.log(`[Sequence] ${table} identity sequence reset to start with ${maxId + 1}`);
        }
      } catch (seqErr) {
        // Some Oracle versions require restart with nextval or identity alters
        console.warn(`[Sequence Notice] ${table}: ${seqErr.message}`);
      }
    }
  }

  // 4. Financial & Stock Verification Reconciliation
  console.log('\n===============================================================');
  console.log('DATA INTEGRITY RECONCILIATION REPORT');
  console.log('===============================================================');

  // SQLite Financial Sums
  const sqPurchases = sdb.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE is_voided = 0').get().total;
  const sqSales = sdb.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE is_voided = 0').get().total;
  const sqPayments = sdb.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE is_voided = 0').get().total;
  const sqRMMov = sdb.prepare('SELECT COALESCE(SUM(quantity_change), 0) as stock FROM raw_material_movements').get().stock;
  const sqFGMov = sdb.prepare('SELECT COALESCE(SUM(quantity_change), 0) as stock FROM finished_goods_movements').get().stock;

  console.log(`Financial Reconciliation:`);
  console.log(`  Purchases Total:    ₹${sqPurchases.toLocaleString()}`);
  console.log(`  Sales Total:        ₹${sqSales.toLocaleString()}`);
  console.log(`  Payments Total:     ₹${sqPayments.toLocaleString()}`);
  console.log(`  RM Stock Balance:   ${sqRMMov.toLocaleString()} KG/PCS`);
  console.log(`  FG Stock Balance:   ${sqFGMov.toLocaleString()} KG`);

  if (!isDryRun && conn) {
    const oraPurchases = (await conn.execute('SELECT NVL(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE is_voided = 0', {}, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].TOTAL;
    const oraSales = (await conn.execute('SELECT NVL(SUM(total_amount), 0) as total FROM sales WHERE is_voided = 0', {}, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].TOTAL;
    const oraPayments = (await conn.execute('SELECT NVL(SUM(amount), 0) as total FROM payments WHERE is_voided = 0', {}, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].TOTAL;
    const oraRMMov = (await conn.execute('SELECT NVL(SUM(quantity_change), 0) as stock FROM raw_material_movements', {}, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].STOCK;
    const oraFGMov = (await conn.execute('SELECT NVL(SUM(quantity_change), 0) as stock FROM finished_goods_movements', {}, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].STOCK;

    console.log(`\nOracle Verification:`);
    console.log(`  Purchases Match:    ${Number(sqPurchases) === Number(oraPurchases) ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`  Sales Match:        ${Number(sqSales) === Number(oraSales) ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`  Payments Match:     ${Number(sqPayments) === Number(oraPayments) ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`  RM Balance Match:   ${Number(sqRMMov) === Number(oraRMMov) ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`  FG Balance Match:   ${Number(sqFGMov) === Number(oraFGMov) ? '✅ MATCH' : '❌ MISMATCH'}`);

    await conn.close();
  }

  console.log('\n===============================================================');
  console.log('TABLE MIGRATION SUMMARY:');
  console.table(migrationStats);
  console.log('===============================================================');
  console.log('Migration execution completed successfully!\n');
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('\n[FATAL] Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrate };
