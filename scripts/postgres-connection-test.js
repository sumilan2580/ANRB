'use strict';

/**
 * TRIPAL ERP — Layerbase PostgreSQL Connection Diagnostic Test
 *
 * Usage:
 *   npm run test:connection
 *   (or) node scripts/postgres-connection-test.js
 *
 * Verifies:
 *   1. Environment variables exist (DATABASE_URL or PGHOST, PGUSER, PGDATABASE)
 *   2. TCP & SSL/TLS handshake with Layerbase PostgreSQL
 *   3. Runs `SELECT NOW() AS current_time, version() AS pg_version`
 *   4. Prints server information and connection latency
 *   5. Never reveals passwords or sensitive auth tokens in terminal output
 */

const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runConnectionTest() {
  console.log('===============================================================');
  console.log('TRIPAL ERP — Layerbase PostgreSQL Connection Diagnostic');
  console.log('===============================================================\n');

  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const pgSsl = process.env.PGSSL;
  const isSsl = pgSsl !== 'false' && pgSsl !== '0';

  if (!connectionString && (!host || !user || !database)) {
    console.error('❌ Configuration Error: Layerbase PostgreSQL credentials missing in .env!\n');
    console.error('Please configure your .env file with either:');
    console.error('  DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require');
    console.error('or separate variables:');
    console.error('  PGHOST=your_host');
    console.error('  PGPORT=5432');
    console.error('  PGDATABASE=your_database');
    console.error('  PGUSER=your_username');
    console.error('  PGPASSWORD=your_password');
    console.error('  PGSSL=true\n');
    console.error('See .env.example for details.');
    process.exit(1);
  }

  let poolConfig;
  let displayHost;
  let displayDb;
  let displayUser;

  if (connectionString) {
    try {
      const parsed = new URL(connectionString);
      displayHost = parsed.hostname;
      displayDb = parsed.pathname.replace(/^\//, '');
      displayUser = parsed.username;
    } catch {
      displayHost = 'Remote URI Host';
      displayDb = 'Database from URI';
      displayUser = 'User from URI';
    }
    poolConfig = {
      connectionString,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000
    };
  } else {
    displayHost = host;
    displayDb = database;
    displayUser = user;
    poolConfig = {
      host,
      port,
      database,
      user,
      password,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000
    };
  }

  console.log(`[Diagnostic] Target Host:     ${displayHost}`);
  console.log(`[Diagnostic] Target Database: ${displayDb}`);
  console.log(`[Diagnostic] User Account:    ${displayUser}`);
  console.log(`[Diagnostic] SSL/TLS Enabled: ${isSsl ? 'YES (Secure TLS)' : 'NO'}`);
  console.log('[Diagnostic] Password:        [PROTECTED / NOT LOGGED]\n');
  console.log('[Diagnostic] Initiating connection handshake to Layerbase PostgreSQL...');

  const startTime = Date.now();
  const testPool = new Pool(poolConfig);

  try {
    const client = await testPool.connect();
    const connectDuration = Date.now() - startTime;
    console.log(`✅ Handshake successful in ${connectDuration}ms!`);

    try {
      const queryStart = Date.now();
      const res = await client.query(`
        SELECT NOW() AS current_time,
               current_database() AS db_name,
               current_user AS db_user,
               version() AS full_version
      `);
      const queryDuration = Date.now() - queryStart;
      const row = res.rows[0];

      console.log('\n--- Server Information ---');
      console.log(`Server Time:      ${row.current_time}`);
      console.log(`Active Database:  ${row.db_name}`);
      console.log(`Connected User:   ${row.db_user}`);
      console.log(`Engine Version:   ${row.full_version.split('\n')[0]}`);
      console.log(`Query Latency:    ${queryDuration}ms`);

      // Check ERP schema readiness
      const tableCheck = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      const existingTables = tableCheck.rows.map(r => r.table_name);
      console.log(`\nExisting Tables in Public Schema: ${existingTables.length}`);

      console.log('\n===============================================================');
      console.log('✅ LAYERBASE POSTGRESQL CONNECTION TEST: PASSED');
      console.log('===============================================================');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('\n❌ Connection Failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('Hint: The PostgreSQL server refused connection. Check host, port, and firewall.');
    } else if (err.code === '28P01') {
      console.error('Hint: Invalid password for the specified user.');
    } else if (err.code === '3D000') {
      console.error('Hint: Specified database does not exist.');
    } else if (err.message.includes('SSL')) {
      console.error('Hint: SSL handshake failed. Make sure PGSSL=true and Layerbase SSL is active.');
    }
    process.exit(1);
  } finally {
    await testPool.end();
  }
}

runConnectionTest().catch(err => {
  console.error('Fatal connection test error:', err.message);
  process.exit(1);
});
