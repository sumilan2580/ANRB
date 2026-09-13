'use strict';

/**
 * TRIPAL ERP — Safe PostgreSQL Migration Runner
 *
 * Designed for safe continuous schema evolution on Layerbase PostgreSQL:
 * 1. Tracks applied migrations in `schema_migrations` table.
 * 2. Every migration runs inside an isolated atomic transaction (BEGIN ... COMMIT).
 * 3. Scans for destructive SQL (DROP TABLE, DROP COLUMN, TRUNCATE) and requires
 *    explicit `--allow-destructive` flag before applying.
 * 4. Never drops or truncates existing production data automatically.
 * 5. Migrations are completely decoupled from frontend build/deployment.
 *
 * Usage:
 *   node scripts/safe-migrate.js                 # Apply pending safe migrations
 *   node scripts/safe-migrate.js --status        # Show migration status
 *   node scripts/safe-migrate.js --create <name> # Scaffold a new migration file
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  const isSsl = process.env.PGSSL !== 'false' && process.env.PGSSL !== '0';

  if (!connectionString) {
    throw new Error('[MIGRATE] DATABASE_URL is required in .env for PostgreSQL migrations.');
  }

  return new Pool({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
  });
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER DEFAULT 0,
      checksum VARCHAR(64) NOT NULL
    );
  `);
}

function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

function checkDestructiveSql(sql) {
  const destructivePatterns = [
    { name: 'DROP TABLE', regex: /\bDROP\s+TABLE\b/i },
    { name: 'DROP COLUMN', regex: /\bDROP\s+COLUMN\b/i },
    { name: 'TRUNCATE', regex: /\bTRUNCATE\b/i },
    { name: 'DATABASE DROP', regex: /\bDROP\s+DATABASE\b/i }
  ];

  const violations = [];
  for (const p of destructivePatterns) {
    if (p.regex.test(sql)) {
      violations.push(p.name);
    }
  }
  return violations;
}

async function getAppliedMigrations(client) {
  const res = await client.query('SELECT version, name, applied_at, checksum FROM schema_migrations ORDER BY version ASC');
  return res.rows;
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function showStatus() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);
    const applied = await getAppliedMigrations(client);
    const appliedMap = new Map(applied.map(a => [a.version, a]));
    const files = getMigrationFiles();

    console.log('\n===============================================================');
    console.log('TRIPAL ERP — DATABASE MIGRATION STATUS');
    console.log('===============================================================');
    console.log('Version / File'.padEnd(45) + 'Status'.padEnd(15) + 'Applied At');
    console.log('---------------------------------------------------------------');

    for (const f of files) {
      const version = f.split('_')[0];
      const rec = appliedMap.get(version);
      if (rec) {
        console.log(f.padEnd(45) + '✅ APPLIED'.padEnd(15) + new Date(rec.applied_at).toLocaleString());
      } else {
        console.log(f.padEnd(45) + '⏳ PENDING'.padEnd(15) + '—');
      }
    }
    console.log('===============================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

function createMigration(name) {
  if (!name) {
    console.error('Error: Please provide a migration name, e.g.: npm run db:migrate:create add_gst_rates');
    process.exit(1);
  }

  const files = getMigrationFiles();
  let nextNum = 1;
  if (files.length > 0) {
    const lastFile = files[files.length - 1];
    const prefix = parseInt(lastFile.split('_')[0], 10);
    if (!isNaN(prefix)) nextNum = prefix + 1;
  }

  const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const filename = `${String(nextNum).padStart(3, '0')}_${cleanName}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- =============================================================================
-- Migration: ${filename}
-- Created At: ${new Date().toISOString()}
-- =============================================================================
-- SAFE MIGRATION GUIDELINES:
-- 1. Use 'ADD COLUMN IF NOT EXISTS' or 'CREATE TABLE IF NOT EXISTS'.
-- 2. Provide sensible DEFAULT values for new non-null columns.
-- 3. DO NOT drop tables or columns without explicit review.
-- =============================================================================

-- Write your migration SQL statements below:

`;

  fs.writeFileSync(filePath, template, 'utf8');
  console.log(`✅ Created new migration file: migrations/${filename}`);
}

async function runMigrations(allowDestructive = false) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);
    const applied = await getAppliedMigrations(client);
    const appliedSet = new Set(applied.map(a => a.version));
    const files = getMigrationFiles();

    // Check if 001 baseline needs initialization
    const baselineFile = files.find(f => f.startsWith('001_'));
    if (baselineFile && !appliedSet.has('001')) {
      // Check if tables already exist
      const checkTables = await client.query(`
        SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'
      `);
      if (parseInt(checkTables.rows[0].c, 10) > 0) {
        // Tables already verified in PostgreSQL — record baseline without re-running
        const content = fs.readFileSync(path.join(MIGRATIONS_DIR, baselineFile), 'utf8');
        const checksum = calculateChecksum(content);
        await client.query(`
          INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
          VALUES ('001', $1, $2, 0)
          ON CONFLICT (version) DO NOTHING
        `, [baselineFile, checksum]);
        console.log(`[MIGRATE] Recorded baseline schema migration: ${baselineFile} (existing production tables preserved).`);
        appliedSet.add('001');
      }
    }

    const pending = files.filter(f => !appliedSet.has(f.split('_')[0]));

    if (pending.length === 0) {
      console.log('✅ Database schema is up to date. No pending migrations.');
      return;
    }

    console.log(`\nFound ${pending.length} pending migration(s):\n`);

    for (const file of pending) {
      const version = file.split('_')[0];
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const checksum = calculateChecksum(sqlContent);

      // Destructive check
      const destructiveOps = checkDestructiveSql(sqlContent);
      if (destructiveOps.length > 0 && !allowDestructive) {
        console.error(`\n❌ BLOCKED: Migration "${file}" contains destructive SQL: ${destructiveOps.join(', ')}.`);
        console.error('To run this migration, you must explicitly supply the --allow-destructive flag.');
        console.error('Migration aborted to protect production data.\n');
        process.exit(1);
      }

      console.log(`Applying migration: ${file}...`);
      const start = Date.now();

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        const duration = Date.now() - start;

        await client.query(`
          INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
          VALUES ($1, $2, $3, $4)
        `, [version, file, checksum, duration]);

        await client.query('COMMIT');
        console.log(`  ↳ ✅ Applied in ${duration}ms`);
      } catch (migErr) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Migration FAILED on "${file}":`, migErr.message);
        console.error('Transaction rolled back. No database changes were applied.\n');
        process.exit(1);
      }
    }

    console.log('\n✅ All migrations applied successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

// ── CLI Dispatch ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus().catch(err => { console.error('Status error:', err.message); process.exit(1); });
} else if (args.includes('--create')) {
  const nameIdx = args.indexOf('--create') + 1;
  createMigration(args[nameIdx]);
} else {
  const allowDestructive = args.includes('--allow-destructive');
  runMigrations(allowDestructive).catch(err => {
    console.error('Migration error:', err.message);
    process.exit(1);
  });
}
