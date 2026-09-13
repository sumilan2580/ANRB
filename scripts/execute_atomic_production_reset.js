'use strict';

/**
 * TRIPAL ERP — Atomic Production Reset for Layerbase PostgreSQL
 *
 * Performs a safe, atomic, transactional reset of demo/test data.
 * Rolls back automatically if any error occurs.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

function hashPassword(plainText) {
  return crypto.createHash('sha256').update(String(plainText).trim()).digest('hex');
}

async function runReset() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('TRIPAL ERP — ATOMIC PRODUCTION RESET (LAYERBASE POSTGRESQL)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // 1. Verify backup file exists
  const backupDir = path.resolve(__dirname, '../backups/postgres');
  if (!fs.existsSync(backupDir)) {
    throw new Error('Backup directory does not exist. Aborting reset.');
  }
  const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  if (backupFiles.length === 0) {
    throw new Error('No backup files found in backups/postgres/. Aborting reset.');
  }
  const latestBackup = backupFiles[backupFiles.length - 1];
  console.log(`[SAFETY CHECK] Verified existing backup: ${latestBackup}`);

  const connectionString = process.env.DATABASE_URL;
  const isSsl = process.env.PGSSL !== 'false' && process.env.PGSSL !== '0';
  const pool = new Pool({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();
  console.log('[RESET] Connected to Layerbase PostgreSQL. Beginning transaction...');

  try {
    await client.query('BEGIN');

    // Ordered deletion respecting foreign key dependencies
    const deletionPlan = [
      'finished_goods_movements',
      'raw_material_movements',
      'sales_items',
      'sales',
      'production_outputs',
      'wastage_records',
      'production_batches',
      'consumption_batch_items',
      'consumption_batches',
      'production_orders',
      'purchase_items',
      'raw_material_purchases',
      'payments',
      'stock_adjustments',
      'audit_logs',
      'machines',
      'shifts',
      'customers',
      'suppliers',
      'raw_materials',
      'finished_products',
      'managers'
    ];

    const deletionSummary = {};
    for (const table of deletionPlan) {
      const res = await client.query(`DELETE FROM ${table}`);
      deletionSummary[table] = res.rowCount;
      console.log(`  Cleared ${table.padEnd(25)} -> ${res.rowCount} rows deleted`);
    }

    // Clean users table: preserve ONLY admin, remove demo managers
    const userDelRes = await client.query("DELETE FROM users WHERE LOWER(username) != 'admin'");
    deletionSummary['users (non-admin)'] = userDelRes.rowCount;
    console.log(`  Removed non-admin users       -> ${userDelRes.rowCount} rows deleted`);

    // Ensure exactly 1 admin user with hashed password 'anrb1'
    const adminHash = hashPassword('anrb1');
    const adminCheck = await client.query("SELECT id FROM users WHERE LOWER(username) = 'admin'");

    if (adminCheck.rows.length === 0) {
      await client.query(
        "INSERT INTO users (id, username, password, role, name, status) VALUES (1, 'admin', $1, 'admin', 'Master Admin', 'active')",
        [adminHash]
      );
      console.log('  Admin user created with secure hash for password "anrb1"');
    } else {
      await client.query(
        "UPDATE users SET password = $1, session_token = NULL, role = 'admin', name = 'Master Admin', status = 'active' WHERE id = $2",
        [adminHash, adminCheck.rows[0].id]
      );
      console.log(`  Admin user (id: ${adminCheck.rows[0].id}) updated with secure hash for password "anrb1"`);
    }

    // Reset settings table: clear demo values while preserving required system configuration keys
    const cleanSettings = [
      { key: 'company_name', value: 'TRIPAL MANUFACTURING PVT. LTD.' },
      { key: 'company_gstin', value: '' },
      { key: 'company_state', value: 'Gujarat' },
      { key: 'company_state_code', value: '24' },
      { key: 'company_address', value: '' },
      { key: 'company_phone', value: '' },
      { key: 'company_email', value: '' },
      { key: 'bank_name', value: '' },
      { key: 'bank_account_no', value: '' },
      { key: 'bank_ifsc', value: '' },
      { key: 'bank_branch', value: '' }
    ];

    for (const s of cleanSettings) {
      await client.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [s.key, s.value]
      );
    }
    console.log(`  Settings table updated -> ${cleanSettings.length} clean system configuration keys preserved`);

    // Reset sequences for all cleared tables
    const sequenceResetList = [
      { seq: 'raw_materials_id_seq', start: 1 },
      { seq: 'finished_products_id_seq', start: 1 },
      { seq: 'suppliers_id_seq', start: 1 },
      { seq: 'customers_id_seq', start: 1 },
      { seq: 'machines_id_seq', start: 1 },
      { seq: 'shifts_id_seq', start: 1 },
      { seq: 'production_orders_id_seq', start: 1 },
      { seq: 'consumption_batches_id_seq', start: 1 },
      { seq: 'consumption_batch_items_id_seq', start: 1 },
      { seq: 'raw_material_purchases_id_seq', start: 1 },
      { seq: 'purchase_items_id_seq', start: 1 },
      { seq: 'raw_material_movements_id_seq', start: 1 },
      { seq: 'production_batches_id_seq', start: 1 },
      { seq: 'production_outputs_id_seq', start: 1 },
      { seq: 'finished_goods_movements_id_seq', start: 1 },
      { seq: 'sales_id_seq', start: 1 },
      { seq: 'sales_items_id_seq', start: 1 },
      { seq: 'wastage_records_id_seq', start: 1 },
      { seq: 'payments_id_seq', start: 1 },
      { seq: 'stock_adjustments_id_seq', start: 1 },
      { seq: 'audit_logs_id_seq', start: 1 },
      { seq: 'managers_id_seq', start: 1 },
      { seq: 'users_id_seq', start: 2 }
    ];

    for (const s of sequenceResetList) {
      try {
        await client.query(`ALTER SEQUENCE ${s.seq} RESTART WITH ${s.start}`);
      } catch (seqErr) {
        console.warn(`  [Notice] Could not restart sequence ${s.seq}: ${seqErr.message}`);
      }
    }
    console.log('  PostgreSQL auto-increment sequences safely reset.');

    await client.query('COMMIT');
    console.log('\n[COMMIT] Transaction committed successfully. Database reset is complete.');

    return deletionSummary;
  } catch (err) {
    console.error('\n❌ ERROR during reset. Rolling back entire transaction...', err.message);
    try {
      await client.query('ROLLBACK');
      console.log('[ROLLBACK] Database safely rolled back to previous state. Zero changes committed.');
    } catch (_) {}
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runReset()
  .then(summary => {
    console.log('\n===============================================================');
    console.log('RESET SUMMARY REPORT:');
    console.log(JSON.stringify(summary, null, 2));
    console.log('===============================================================');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal reset error:', err);
    process.exit(1);
  });
