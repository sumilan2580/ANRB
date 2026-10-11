'use strict';

/**
 * TRIPAL ERP / ANRB — Neon PostgreSQL Target Connection & Capability Diagnostic
 */

const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.neon') });

async function testNeon() {
  console.log('===============================================================');
  console.log('ANRB / TRIPAL ERP — NEON TARGET CONNECTION TEST');
  console.log('===============================================================\n');

  const neonUrl = process.env.NEON_DATABASE_URL;
  if (!neonUrl) {
    throw new Error('NEON_DATABASE_URL is missing in .env.neon');
  }

  const pool = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });

  const client = await pool.connect();

  try {
    console.log('[1/7] Testing basic query & engine info...');
    const infoRes = await client.query(`
      SELECT NOW() AS current_time,
             current_database() AS db_name,
             current_user AS db_user,
             version() AS pg_version;
    `);
    const info = infoRes.rows[0];
    console.log(`  Database Name:  ${info.db_name}`);
    console.log(`  Connected User: ${info.db_user}`);
    console.log(`  PG Version:     ${info.pg_version.split(' on ')[0]}`);

    console.log('\n[2/7] Checking existing tables in public schema...');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    console.log(`  Existing public tables: ${tablesRes.rows.length}`);

    console.log('\n[3/7] Testing transactional capability...');
    await client.query('BEGIN');
    await client.query('SELECT 1 AS tx_check');
    await client.query('COMMIT');
    console.log('  Transaction BEGIN/COMMIT succeeded.');

    console.log('\n[4/7] Testing temporary table creation & sequence generation...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _neon_healthcheck_test (
        id SERIAL PRIMARY KEY,
        test_val VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  Table created successfully.');

    console.log('\n[5/7] Testing INSERT, RETURNING, & SELECT permissions...');
    const insRes = await client.query(`
      INSERT INTO _neon_healthcheck_test (test_val) VALUES ($1) RETURNING id;
    `, ['neon_test_entry']);
    const testId = insRes.rows[0].id;
    console.log(`  Inserted row id: ${testId}`);

    const selRes = await client.query('SELECT * FROM _neon_healthcheck_test WHERE id = $1', [testId]);
    if (!selRes.rows.length || selRes.rows[0].test_val !== 'neon_test_entry') {
      throw new Error('Verification query returned unexpected result');
    }
    console.log('  Select query verified successfully.');

    console.log('\n[6/7] Testing index creation on target...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_healthcheck_val ON _neon_healthcheck_test (test_val);
    `);
    console.log('  Index creation verified.');

    console.log('\n[7/7] Cleaning up test table...');
    await client.query('DROP TABLE IF EXISTS _neon_healthcheck_test CASCADE;');
    console.log('  Cleanup completed.');

    console.log('\n===============================================================');
    console.log('✅ NEON TARGET CONNECTION & CAPABILITY TEST: PASSED (100%)');
    console.log('===============================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

testNeon().catch(err => {
  console.error('\n❌ Neon connection test failed:', err.message);
  process.exit(1);
});
