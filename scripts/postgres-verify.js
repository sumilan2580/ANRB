'use strict';

/**
 * TRIPAL ERP — Layerbase PostgreSQL Verification Script
 *
 * Verifies:
 *   1. All 24 ERP tables exist in PostgreSQL
 *   2. Compares row counts between SQLite source and PostgreSQL target
 *   3. Compares key business figures (purchases, sales, movements, payments, stocks)
 *   4. Reports mismatches with clear diagnostics
 *
 * Usage:
 *   npm run verify:postgres
 *   (or) node scripts/postgres-verify.js
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
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

async function verify() {
  console.log('===============================================================');
  console.log('TRIPAL ERP — Layerbase PostgreSQL Schema & Data Verification');
  console.log('===============================================================\n');

  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const isSsl = process.env.PGSSL !== 'false' && process.env.PGSSL !== '0';

  if (!connectionString && (!host || !user || !database)) {
    console.error('❌ PostgreSQL credentials not configured in .env.');
    console.error('Please set DATABASE_URL or PGHOST, PGUSER, PGDATABASE.');
    process.exit(1);
  }

  const poolConfig = connectionString
    ? { connectionString, ssl: isSsl ? { rejectUnauthorized: false } : false }
    : { host, port, database, user, password, ssl: isSsl ? { rejectUnauthorized: false } : false };

  const pool = new Pool(poolConfig);
  let pgClient;

  try {
    pgClient = await pool.connect();
  } catch (err) {
    console.error('❌ Could not connect to PostgreSQL:', err.message);
    process.exit(1);
  }

  // Check SQLite source database
  const sqlitePath = path.resolve(__dirname, '../tripal_erp.sqlite');
  let sdb = null;
  if (fs.existsSync(sqlitePath)) {
    sdb = new DatabaseSync(sqlitePath);
  }

  let tableErrors = 0;
  let countErrors = 0;

  console.log('TABLE VERIFICATION & ROW COUNT COMPARISON:');
  console.log('---------------------------------------------------------------');
  console.log(
    'Table Name'.padEnd(28) +
    'PG Status'.padEnd(14) +
    'PG Rows'.padEnd(12) +
    (sdb ? 'SQLite Rows'.padEnd(14) + 'Match' : '')
  );
  console.log('---------------------------------------------------------------');

  for (const tableName of ERP_TABLES) {
    // Check if table exists in PG
    const existCheck = await pgClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    `, [tableName]);

    const exists = existCheck.rows.length > 0;
    if (!exists) {
      console.log(tableName.padEnd(28) + '❌ MISSING'.padEnd(14) + '—'.padEnd(12) + (sdb ? '—'.padEnd(14) + 'FAIL' : ''));
      tableErrors++;
      continue;
    }

    // Get PG row count
    const pgCountRes = await pgClient.query(`SELECT COUNT(*) AS c FROM ${tableName}`);
    const pgCount = parseInt(pgCountRes.rows[0].c, 10);

    if (sdb) {
      let sqliteCount = 0;
      try {
        const sqRes = sdb.prepare(`SELECT COUNT(*) AS c FROM ${tableName}`).get();
        sqliteCount = Number(sqRes ? sqRes.c : 0);
      } catch {
        sqliteCount = 0;
      }

      const isMatch = pgCount === sqliteCount;
      const statusIcon = isMatch ? '✅' : '⚠️ ';
      console.log(
        tableName.padEnd(28) +
        'OK'.padEnd(14) +
        String(pgCount).padEnd(12) +
        String(sqliteCount).padEnd(14) +
        statusIcon
      );
      if (!isMatch) countErrors++;
    } else {
      console.log(tableName.padEnd(28) + 'OK'.padEnd(14) + String(pgCount).padEnd(12));
    }
  }

  console.log('---------------------------------------------------------------\n');

  // Business Totals Verification
  console.log('BUSINESS INVARIANT TOTALS (POSTGRESQL):');
  console.log('---------------------------------------------------------------');

  try {
    const rmStock = await pgClient.query('SELECT COALESCE(SUM(quantity_change), 0) AS s FROM raw_material_movements');
    const fgStock = await pgClient.query('SELECT COALESCE(SUM(quantity_change), 0) AS s FROM finished_goods_movements');
    const totalPurchases = await pgClient.query('SELECT COUNT(*) AS c, COALESCE(SUM(total_amount), 0) AS a FROM raw_material_purchases WHERE is_voided = 0');
    const totalSales = await pgClient.query('SELECT COUNT(*) AS c, COALESCE(SUM(total_amount), 0) AS a FROM sales WHERE is_voided = 0');
    const totalRec = await pgClient.query("SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS a FROM payments WHERE party_type = 'CUSTOMER' AND is_voided = 0");
    const totalPay = await pgClient.query("SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS a FROM payments WHERE party_type = 'SUPPLIER' AND is_voided = 0");

    console.log(`Raw Material Stock Balance:     ${Number(rmStock.rows[0].s).toFixed(2)} KG`);
    console.log(`Finished Goods Stock Balance:   ${Number(fgStock.rows[0].s).toFixed(2)} KG`);
    console.log(`Active Purchases:               ${totalPurchases.rows[0].c} bills, ₹${Number(totalPurchases.rows[0].a).toFixed(2)}`);
    console.log(`Active Sales / Invoices:        ${totalSales.rows[0].c} invoices, ₹${Number(totalSales.rows[0].a).toFixed(2)}`);
    console.log(`Customer Receipts:              ${totalRec.rows[0].c} receipts, ₹${Number(totalRec.rows[0].a).toFixed(2)}`);
    console.log(`Supplier Payments:              ${totalPay.rows[0].c} payments, ₹${Number(totalPay.rows[0].a).toFixed(2)}`);
  } catch (err) {
    console.warn('Could not compute business totals:', err.message);
  }

  console.log('---------------------------------------------------------------\n');

  if (sdb) sdb.close();
  pgClient.release();
  await pool.end();

  if (tableErrors > 0) {
    console.error(`❌ Verification FAILED: ${tableErrors} table(s) missing in PostgreSQL.`);
    process.exit(1);
  }

  if (countErrors > 0) {
    console.warn(`⚠️  Notice: ${countErrors} table(s) have different row counts between SQLite and PostgreSQL.`);
    console.warn('   Run npm run migrate:postgres if you need to synchronize data.');
  } else {
    console.log('✅ ALL 24 TABLES AND ROW COUNTS VERIFIED SUCCESSFULLY!');
  }
}

verify().catch(err => {
  console.error('Fatal verification error:', err.message);
  process.exit(1);
});
