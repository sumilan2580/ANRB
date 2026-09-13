'use strict';

/**
 * TRIPAL ERP - Production Migration Script: SQLite -> Layerbase PostgreSQL
 *
 * Safety Guarantees:
 *   - NEVER deletes SQLite database or files.
 *   - Creates automatic timestamped backup snapshot of SQLite before starting.
 *   - Uses SET LOCAL session_replication_role = replica during inserts to disable
 *     FK trigger enforcement (required: SQLite had orphaned FK refs in production_batches
 *     pointing to deleted consumption_batches rows - preserved exactly as-is).
 *   - Wraps entire migration in ONE ATOMIC TRANSACTION - any failure rolls back everything.
 *   - --clean flag: safely purges partial migration data before re-running.
 *   - Fixes setval() with correct third arg 'true' so next auto-ID is MAX+1.
 *
 * Usage:
 *   npm run migrate:postgres               (actual migration)
 *   npm run migrate:postgres:dry           (dry run)
 *   node scripts/migrate-sqlite-to-postgres.js --clean  (clean partial then migrate)
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const isDryRun = process.argv.includes('--dry-run');
const doClean = process.argv.includes('--clean');

// Tables in strict FK dependency order (parent before child)
const MIGRATION_TABLES = [
  { name: 'users',                    hasSerial: true  },
  { name: 'managers',                 hasSerial: true  },
  { name: 'raw_materials',            hasSerial: true  },
  { name: 'suppliers',                hasSerial: true  },
  { name: 'customers',                hasSerial: true  },
  { name: 'machines',                 hasSerial: true  },
  { name: 'shifts',                   hasSerial: true  },
  { name: 'finished_products',        hasSerial: true  },
  { name: 'production_orders',        hasSerial: true  },
  { name: 'consumption_batches',      hasSerial: true  },
  { name: 'consumption_batch_items',  hasSerial: true  },
  { name: 'raw_material_purchases',   hasSerial: true  },
  { name: 'purchase_items',           hasSerial: true  },
  { name: 'raw_material_movements',   hasSerial: true  },
  { name: 'production_batches',       hasSerial: true  },
  { name: 'production_outputs',       hasSerial: true  },
  { name: 'finished_goods_movements', hasSerial: true  },
  { name: 'sales',                    hasSerial: true  },
  { name: 'sales_items',              hasSerial: true  },
  { name: 'wastage_records',          hasSerial: true  },
  { name: 'payments',                 hasSerial: true  },
  { name: 'stock_adjustments',        hasSerial: true  },
  { name: 'audit_logs',               hasSerial: true  },
  { name: 'settings',                 hasSerial: false }
];

// Reverse dependency order for safe cleanup
const CLEANUP_ORDER = [
  'audit_logs', 'stock_adjustments', 'payments', 'wastage_records',
  'sales_items', 'sales',
  'finished_goods_movements', 'production_outputs', 'production_batches',
  'raw_material_movements', 'purchase_items', 'raw_material_purchases',
  'consumption_batch_items', 'consumption_batches',
  'production_orders', 'finished_products', 'shifts', 'machines',
  'customers', 'suppliers', 'raw_materials', 'managers', 'users',
  'settings'
];

function createBackup(sqlitePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(__dirname, `../tripal_erp.sqlite.migration_backup_${timestamp}`);
  fs.copyFileSync(sqlitePath, backupPath);
  console.log(`[Backup] Created safety snapshot: ${path.basename(backupPath)}`);
  return backupPath;
}

function sanitizeValue(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number' && isNaN(val)) return null;
  return val;
}

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const isSsl = process.env.PGSSL !== 'false' && process.env.PGSSL !== '0';

  if (!connectionString && (!host || !user || !database)) {
    console.error('Configuration Error: Layerbase PostgreSQL credentials missing in .env');
    process.exit(1);
  }

  return connectionString
    ? { connectionString, ssl: isSsl ? { rejectUnauthorized: false } : false }
    : { host, port, database, user, password, ssl: isSsl ? { rejectUnauthorized: false } : false };
}

async function migrate() {
  console.log('===============================================================');
  console.log('TRIPAL ERP - PRODUCTION MIGRATION: SQLite -> Layerbase PostgreSQL');
  console.log('===============================================================\n');

  if (isDryRun) console.log('*** DRY-RUN MODE: No changes will be written to PostgreSQL ***\n');

  // Step 1: Validate and backup SQLite
  const sqlitePath = path.resolve(__dirname, '../tripal_erp.sqlite');
  if (!fs.existsSync(sqlitePath)) throw new Error(`SQLite not found: ${sqlitePath}`);
  createBackup(sqlitePath);
  const sdb = new DatabaseSync(sqlitePath);

  // Step 2: Read all SQLite data upfront, then close SQLite immediately
  console.log('\n--- STEP 1: Reading SQLite source data ---');
  const sqliteData = {};
  let totalSqliteRows = 0;

  for (const tableConfig of MIGRATION_TABLES) {
    const t = tableConfig.name;
    try {
      const rows = sdb.prepare(`SELECT * FROM ${t}`).all();
      sqliteData[t] = rows;
      totalSqliteRows += rows.length;
      console.log(`  [${t}]: ${rows.length} rows`);
    } catch (err) {
      console.warn(`  WARNING: Cannot read [${t}]: ${err.message}`);
      sqliteData[t] = [];
    }
  }
  sdb.close();
  console.log(`\n  Total: ${totalSqliteRows} rows. SQLite closed (preserved).\n`);

  // Step 3: FK orphan report (informational)
  console.log('--- STEP 2: FK Orphan Analysis ---');
  const cbIds = new Set((sqliteData['consumption_batches'] || []).map(r => r.id));
  const pbOrphaned = (sqliteData['production_batches'] || []).filter(
    r => r.consumption_batch_id !== null && !cbIds.has(r.consumption_batch_id)
  );
  if (pbOrphaned.length > 0) {
    console.log(`  INFO: production_batches has ${pbOrphaned.length} rows referencing deleted consumption_batches:`);
    console.log(`        consumption_batch_id values: ${[...new Set(pbOrphaned.map(r => r.consumption_batch_id))].join(', ')}`);
    console.log(`        This matches SQLite source-of-truth (SQLite FK not enforced).`);
    console.log(`        Migration will preserve this using session_replication_role=replica.`);
  } else {
    console.log('  All FK references are clean.');
  }
  console.log('');

  // Dry-run ends here
  if (isDryRun) {
    console.log('--- DRY-RUN PLAN ---');
    for (const tc of MIGRATION_TABLES) {
      const n = (sqliteData[tc.name] || []).length;
      console.log(`  [${tc.name}]: ${n > 0 ? `would migrate ${n} rows` : 'empty - skip'}`);
    }
    console.log(`\nDRY-RUN TOTAL: ${totalSqliteRows} rows across all tables.`);
    console.log('SQLite preserved. Run without --dry-run to migrate.');
    return;
  }

  // Step 4: Connect to PostgreSQL
  const pool = new Pool(getPoolConfig());
  const client = await pool.connect();

  try {
    console.log('[PostgreSQL] Connected to Layerbase PostgreSQL.\n');

    // Step 5: Apply schema (idempotent CREATE TABLE IF NOT EXISTS)
    console.log('--- STEP 3: Applying schema ---');
    const schemaPath = path.resolve(__dirname, 'postgres-schema.sql');
    if (fs.existsSync(schemaPath)) {
      await client.query(fs.readFileSync(schemaPath, 'utf8'));
      console.log('  Schema applied (idempotent - CREATE IF NOT EXISTS).\n');
    }

    // Step 6: Audit existing PG data
    console.log('--- STEP 4: Auditing PostgreSQL target state ---');
    let existingTotal = 0;
    for (const tc of MIGRATION_TABLES) {
      try {
        const res = await client.query(`SELECT COUNT(*) AS c FROM ${tc.name}`);
        const cnt = parseInt(res.rows[0].c, 10);
        if (cnt > 0) {
          existingTotal += cnt;
          console.log(`  [${tc.name}]: ${cnt} existing rows`);
        }
      } catch (_) {}
    }

    if (existingTotal > 0 && !doClean) {
      console.warn(`\nPostgreSQL contains ${existingTotal} rows (partial migration).`);
      console.warn('To clean and re-run, use:');
      console.warn('  node scripts/migrate-sqlite-to-postgres.js --clean');
      console.warn('Only do this if PostgreSQL has NO legitimate production data.\n');
      client.release();
      await pool.end();
      return;
    }

    // Step 6b: Clean partial data if --clean
    if (existingTotal > 0 && doClean) {
      console.log('\n  [--clean] Purging partial migration data in reverse-dependency order...');
      await client.query('BEGIN');
      try {
        await client.query('SET session_replication_role = replica');
        for (const t of CLEANUP_ORDER) {
          try {
            const res = await client.query(`DELETE FROM ${t}`);
            if (res.rowCount > 0) console.log(`    Deleted ${res.rowCount} rows from [${t}]`);
          } catch (e) {
            console.warn(`    Could not delete [${t}]: ${e.message}`);
          }
        }
        await client.query('SET session_replication_role = DEFAULT');
        await client.query('COMMIT');
        console.log('  Partial data cleaned.\n');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Clean failed: ${err.message}`);
      }
    } else {
      console.log('  PostgreSQL target is empty - ready.\n');
    }

    // Step 7: ATOMIC MIGRATION
    console.log('--- STEP 5: Migrating all tables (single atomic transaction) ---');
    console.log('  FK enforcement disabled via session_replication_role=replica for this session.');
    console.log('  Any failure will ROLLBACK all changes atomically.\n');

    await client.query('BEGIN');

    let totalMigrated = 0;
    try {
      await client.query('SET LOCAL session_replication_role = replica');

      for (const tableConfig of MIGRATION_TABLES) {
        const t = tableConfig.name;
        const rows = sqliteData[t] || [];

        if (rows.length === 0) {
          console.log(`  [${t}]: empty - skip`);
          continue;
        }

        const columns = Object.keys(rows[0]);
        const colList = columns.join(', ');
        let count = 0;

        for (const row of rows) {
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const values = columns.map(c => sanitizeValue(row[c]));

          let sql;
          if (t === 'settings') {
            sql = `INSERT INTO ${t} (${colList}) VALUES (${placeholders})
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`;
          } else {
            sql = `INSERT INTO ${t} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
          }

          await client.query(sql, values);
          count++;
        }

        // Correct sequence reset: setval(seq, max_id, true) -> next ID = max_id + 1
        if (tableConfig.hasSerial) {
          await client.query(`
            SELECT setval(
              pg_get_serial_sequence('${t}', 'id'),
              COALESCE((SELECT MAX(id) FROM ${t}), 1),
              true
            )
          `);
        }

        console.log(`  [${t}]: ${count} rows migrated, sequence reset`);
        totalMigrated += count;
      }

      await client.query('SET LOCAL session_replication_role = DEFAULT');
      await client.query('COMMIT');

      console.log('\n===============================================================');
      console.log(`MIGRATION COMPLETE: ${totalMigrated} rows migrated.`);
      console.log('===============================================================\n');

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('\nMIGRATION FAILED - all changes ROLLED BACK atomically.');
      console.error('PostgreSQL is in a clean state.');
      console.error(`Error: ${err.message}`);
      if (err.detail) console.error(`Detail: ${err.detail}`);
      throw err;
    }

    // Step 8: Post-migration verification
    console.log('--- STEP 6: Post-migration verification ---');
    let allPassed = true;
    let totalPgRows = 0;

    for (const tc of MIGRATION_TABLES) {
      const t = tc.name;
      const src = (sqliteData[t] || []).length;
      const pgRes = await client.query(`SELECT COUNT(*) AS c FROM ${t}`);
      const pg = parseInt(pgRes.rows[0].c, 10);
      totalPgRows += pg;
      const ok = pg >= src;
      if (!ok) allPassed = false;
      console.log(`  ${ok ? 'OK' : 'FAIL'} [${t}]: SQLite=${src}, PostgreSQL=${pg}`);
    }

    // Business relationship checks
    console.log('\n  -- FK Relationship Checks --');

    const piOrphans = await client.query(
      `SELECT COUNT(*) AS c FROM purchase_items pi
       WHERE NOT EXISTS (SELECT 1 FROM raw_material_purchases p WHERE p.id = pi.purchase_id)`
    );
    const piOk = parseInt(piOrphans.rows[0].c, 10) === 0;
    console.log(`  ${piOk ? 'OK' : 'FAIL'} purchase_items -> raw_material_purchases`);
    if (!piOk) allPassed = false;

    const siOrphans = await client.query(
      `SELECT COUNT(*) AS c FROM sales_items si
       WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = si.sale_id)`
    );
    const siOk = parseInt(siOrphans.rows[0].c, 10) === 0;
    console.log(`  ${siOk ? 'OK' : 'FAIL'} sales_items -> sales`);
    if (!siOk) allPassed = false;

    const cbiOrphans = await client.query(
      `SELECT COUNT(*) AS c FROM consumption_batch_items cbi
       WHERE NOT EXISTS (SELECT 1 FROM consumption_batches cb WHERE cb.id = cbi.consumption_batch_id)`
    );
    const cbiOk = parseInt(cbiOrphans.rows[0].c, 10) === 0;
    console.log(`  ${cbiOk ? 'OK' : 'FAIL'} consumption_batch_items -> consumption_batches`);
    if (!cbiOk) allPassed = false;

    const pbResolved = await client.query(
      `SELECT COUNT(*) AS c FROM production_batches pb
       INNER JOIN consumption_batches cb ON pb.consumption_batch_id = cb.id
       WHERE pb.consumption_batch_id IS NOT NULL`
    );
    const pbTotal = await client.query(
      `SELECT COUNT(*) AS c FROM production_batches WHERE consumption_batch_id IS NOT NULL`
    );
    const pbOrphanCount = parseInt(pbTotal.rows[0].c, 10) - parseInt(pbResolved.rows[0].c, 10);
    console.log(`  INFO production_batches.consumption_batch_id: ${pbResolved.rows[0].c} resolved, ${pbOrphanCount} orphaned (expected - matches SQLite)`);

    // Sequence verification
    console.log('\n  -- Sequence Verification --');
    for (const tc of MIGRATION_TABLES) {
      if (!tc.hasSerial) continue;
      const t = tc.name;
      try {
        const seqRes = await client.query(`SELECT last_value FROM ${t}_id_seq`);
        const maxRes = await client.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${t}`);
        const seq = parseInt(seqRes.rows[0].last_value, 10);
        const maxId = parseInt(maxRes.rows[0].m, 10);
        const ok = seq >= maxId;
        if (!ok) allPassed = false;
        console.log(`  ${ok ? 'OK' : 'FAIL'} [${t}]: seq=${seq}, max_id=${maxId}`);
      } catch (_) {}
    }

    console.log('\n===============================================================');
    if (allPassed) {
      console.log(`ALL CHECKS PASSED: ${totalPgRows} rows in PostgreSQL.`);
    } else {
      console.log('SOME CHECKS FAILED - review output above.');
    }
    console.log('===============================================================\n');
    console.log('SQLite PRESERVED: tripal_erp.sqlite (untouched)');
    console.log('Next step: npm run dev');
    console.log('Verify: npm run verify:postgres');

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Fatal migration error:', err.message);
  process.exit(1);
});
