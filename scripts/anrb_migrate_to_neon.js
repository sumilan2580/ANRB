'use strict';

/**
 * TRIPAL ERP / ANRB — MASTER ZERO-DATA-LOSS MIGRATION EXECUTOR
 * SOURCE: Layerbase PostgreSQL (Read-Only)
 * TARGET: Neon PostgreSQL (Isolated ANRB Project)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configurations
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const neonEnv = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.neon')));
const neonUrl = neonEnv.NEON_DATABASE_URL;

if (!process.env.DATABASE_URL) {
  console.error('FATAL: Source DATABASE_URL (Layerbase) missing in .env!');
  process.exit(1);
}
if (!neonUrl) {
  console.error('FATAL: Target NEON_DATABASE_URL missing in .env.neon!');
  process.exit(1);
}

// 33 Tables in dependency-safe insertion order
const ORDERED_TABLES = [
  'financial_years',
  'expense_heads',
  'bank_accounts',
  'settings',
  'shifts',
  'machines',
  'raw_materials',
  'finished_products',
  'suppliers',
  'customers',
  'staff',
  'managers',
  'users',
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
  'payments',
  'bank_transfers',
  'opening_balances',
  'debit_credit_notes',
  'wastage_records',
  'stock_adjustments',
  'staff_attendance',
  'audit_logs',
  'schema_migrations'
];

async function runMigration() {
  console.log('======================================================================');
  console.log('ANRB / TRIPAL ERP — MASTER PRODUCTION DATABASE MIGRATION');
  console.log('SOURCE: Layerbase PostgreSQL (Read-Only)');
  console.log('TARGET: Neon PostgreSQL (New Dedicated ANRB Project)');
  console.log('======================================================================\n');

  const sourcePool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  const targetPool = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  const srcClient = await sourcePool.connect();
  const tgtClient = await targetPool.connect();

  const migrationStats = {
    started_at: new Date().toISOString(),
    tables_migrated: 0,
    records_migrated: 0,
    sequences_reset: 0,
    table_counts: {}
  };

  try {
    console.log('[Phase 6 & 7] Applying exact table structures, PKs, UQs, and CHECKs on Neon...');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, 'neon_exact_schema.sql'), 'utf8');

    // Split schema into parts: 1) Tables & PKs & UQs & Checks, 2) Indexes, 3) Foreign Keys
    const parts = schemaSql.split('-- =====================================================================\n-- FOREIGN KEYS');
    const tableAndConstraintsPart = parts[0];
    const foreignKeysPart = parts[1] ? ('-- =====================================================================\n-- FOREIGN KEYS' + parts[1]) : '';

    // Execute schema tables & primary keys
    await tgtClient.query(tableAndConstraintsPart);
    console.log('  ✅ Base tables and primary/unique/check constraints applied to Neon.');

    console.log('\n[Phase 8] Migrating data for all 33 tables with original IDs preserved...');
    
    for (const tableName of ORDERED_TABLES) {
      const srcRowsRes = await srcClient.query(`SELECT * FROM "${tableName}" ORDER BY 1 ASC`);
      const rows = srcRowsRes.rows;
      const count = rows.length;

      console.log(`  Processing table [${tableName.padEnd(28)}]: ${String(count).padStart(5)} rows to transfer...`);

      if (count > 0) {
        // Fetch target columns to match
        const cols = Object.keys(rows[0]);
        const quotedCols = cols.map(c => `"${c}"`).join(', ');

        await tgtClient.query('BEGIN');
        try {
          // Truncate target table just in case of prior partial run, preserving target schema
          await tgtClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

          // Insert rows in batches of 50
          const batchSize = 50;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const valueClauses = [];
            const bindValues = [];
            let paramIdx = 1;

            for (const row of batch) {
              const rowPlaceholders = [];
              for (const col of cols) {
                let val = row[col];
                // If value is an object or array and not null/Date, serialize to string for JSON/JSONB
                if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
                  val = JSON.stringify(val);
                }
                bindValues.push(val);
                rowPlaceholders.push(`$${paramIdx++}`);
              }
              valueClauses.push(`(${rowPlaceholders.join(', ')})`);
            }

            const insertSql = `INSERT INTO "${tableName}" (${quotedCols}) VALUES ${valueClauses.join(', ')}`;
            await tgtClient.query(insertSql, bindValues);
          }

          await tgtClient.query('COMMIT');
        } catch (err) {
          await tgtClient.query('ROLLBACK');
          throw new Error(`Failed to insert into ${tableName}: ${err.message}`);
        }
      }

      // Verify row count immediately
      const tgtCountRes = await tgtClient.query(`SELECT COUNT(*) AS c FROM "${tableName}"`);
      const tgtCount = parseInt(tgtCountRes.rows[0].c, 10);
      if (tgtCount !== count) {
        throw new Error(`Data mismatch on table ${tableName}: source=${count}, target=${tgtCount}`);
      }

      migrationStats.table_counts[tableName] = { source: count, target: tgtCount, diff: 0 };
      migrationStats.tables_migrated++;
      migrationStats.records_migrated += count;
    }

    console.log('\n[Phase 7b] Applying Foreign Key constraints on Neon...');
    if (foreignKeysPart) {
      await tgtClient.query(foreignKeysPart);
      console.log('  ✅ Foreign keys successfully created on Neon.');
    }

    console.log('\n[Phase 9] Synchronizing and resetting sequences on Neon...');
    // Discover all sequences on Neon
    const tgtSeqRes = await tgtClient.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name;
    `);

    for (const r of tgtSeqRes.rows) {
      const seqName = r.sequence_name;
      // Identify corresponding table and column
      // e.g. "users_id_seq" -> table "users", column "id"
      let tableName = null;
      let colName = 'id';

      // Query pg_depend to find exact table & column for sequence
      const depRes = await tgtClient.query(`
        SELECT c.relname AS table_name, a.attname AS col_name
        FROM pg_class s
        JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass
        JOIN pg_class c ON c.oid = d.refobjid
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.refobjsubid
        WHERE s.relname = $1 AND s.relkind = 'S';
      `, [seqName]);

      if (depRes.rows.length > 0) {
        tableName = depRes.rows[0].table_name;
        colName = depRes.rows[0].col_name;
      } else {
        // Fallback pattern matching
        const match = seqName.match(/^(.+)_(id)_seq$/);
        if (match) {
          tableName = match[1];
        }
      }

      let maxVal = 1;
      if (tableName) {
        const maxRes = await tgtClient.query(`SELECT COALESCE(MAX("${colName}"), 0) AS max_val FROM "${tableName}"`);
        maxVal = parseInt(maxRes.rows[0].max_val, 10);
      }

      // Check source sequence state if available
      let srcLastVal = 1;
      try {
        const srcSeqRes = await srcClient.query(`SELECT last_value FROM "${seqName}"`);
        srcLastVal = parseInt(srcSeqRes.rows[0].last_value, 10);
      } catch (_) {}

      const safeNextVal = Math.max(maxVal, srcLastVal, 1);
      const isCalled = maxVal > 0;
      await tgtClient.query(`SELECT setval('"${seqName}"', ${safeNextVal}, ${isCalled ? 'true' : 'false'})`);
      console.log(`  Reset sequence [${seqName.padEnd(32)}]: setval = ${safeNextVal} (is_called: ${isCalled})`);
      migrationStats.sequences_reset++;
    }

    migrationStats.completed_at = new Date().toISOString();

    console.log('\n======================================================================');
    console.log('✅ DATA MIGRATION COMPLETED SUCCESSFULLY!');
    console.log(`Tables Migrated:   ${migrationStats.tables_migrated} / 33`);
    console.log(`Records Migrated:  ${migrationStats.records_migrated} / 1209`);
    console.log(`Sequences Reset:   ${migrationStats.sequences_reset}`);
    console.log('======================================================================\n');

    fs.writeFileSync(
      path.resolve(__dirname, '../scratch/migration_stats.json'),
      JSON.stringify(migrationStats, null, 2),
      'utf8'
    );
  } finally {
    srcClient.release();
    tgtClient.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

runMigration().catch(err => {
  console.error('\n❌ MIGRATION FAILED:', err);
  process.exit(1);
});
