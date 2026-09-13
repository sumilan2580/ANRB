'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const businessTables = [
    'raw_materials', 'finished_products', 'suppliers', 'customers', 'machines', 'shifts',
    'production_orders', 'consumption_batches', 'consumption_batch_items',
    'raw_material_purchases', 'purchase_items', 'raw_material_movements',
    'production_batches', 'production_outputs', 'finished_goods_movements',
    'sales', 'sales_items', 'wastage_records', 'payments', 'stock_adjustments',
    'audit_logs', 'managers'
  ];

  console.log('\n=== POST-RESET VERIFICATION ===\n');
  let allZero = true;
  for (const t of businessTables) {
    const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
    const n = parseInt(r.rows[0].count);
    if (n !== 0) allZero = false;
    console.log(`${n === 0 ? '✓' : '✗ FAIL'}  ${t.padEnd(32)} ${n} rows`);
  }

  // Check admin user
  const u = await pool.query("SELECT id, username, role, status FROM users WHERE LOWER(username)='admin'");
  const uCount = await pool.query('SELECT COUNT(*) FROM users');
  const mCount = await pool.query('SELECT COUNT(*) FROM managers');

  console.log('\n=== ADMIN USER ===');
  if (u.rows.length > 0) {
    const row = u.rows[0];
    console.log(`  id: ${row.id}, username: ${row.username}, role: ${row.role}, status: ${row.status}`);
  } else {
    console.log('  ✗ FAIL — admin user NOT found!');
  }
  console.log(`  Total users in DB: ${uCount.rows[0].count}`);
  console.log(`  Total managers in DB: ${mCount.rows[0].count}`);

  // Check sequences are reset
  const seqCheck = await pool.query(`
    SELECT sequence_name, last_value
    FROM information_schema.sequences
    JOIN pg_sequences ON sequencename = sequence_name
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);
  console.log('\n=== SEQUENCES (last_value should be 1 for all business tables) ===');
  for (const row of seqCheck.rows) {
    const ok = parseInt(row.last_value) <= 1;
    console.log(`${ok ? '✓' : '⚠'}  ${row.sequence_name.padEnd(40)} last_value=${row.last_value}`);
  }

  console.log('\n' + (allZero
    ? '✅ ALL BUSINESS TABLES EMPTY — CLEAN PRODUCTION STATE CONFIRMED'
    : '❌ Some tables still have data — review above'));

  console.log(u.rows.length > 0
    ? '✅ Admin account intact and secured'
    : '❌ Admin account missing!');

  await pool.end();
})().catch(e => { console.error('Verification error:', e.message); process.exit(1); });
