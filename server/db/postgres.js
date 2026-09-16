'use strict';

/**
 * TRIPAL ERP — Layerbase PostgreSQL Database Module
 *
 * Official PostgreSQL client integration using `pg.Pool`.
 * Handles connection pooling, secure SSL/TLS connection for Layerbase,
 * transactions, SQL parameter normalization ($1, $2...), and sequence-safe operations.
 *
 * Credentials read ONLY from environment variables.
 * Sensitive data like passwords or tokens are never printed to logs.
 */

const { Pool, types } = require('pg');
const path = require('path');

// Ensure NUMERIC / DECIMAL (type ID 1700) and BIGINT (type ID 20) are parsed to numbers
types.setTypeParser(1700, val => (val === null ? null : parseFloat(val)));
types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10)));

// Load .env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let pool = null;
let cachedCompanySettings = null;

/**
 * Builds PostgreSQL pool configuration safely from environment variables.
 */
function buildPoolConfig() {
  const connectionString = process.env.DATABASE_URL;

  // SSL Configuration: Layerbase requires secure TLS/SSL
  const pgSslEnv = process.env.PGSSL;
  const isSslEnabled = pgSslEnv !== 'false' && pgSslEnv !== '0';

  const sslConfig = isSslEnabled ? { rejectUnauthorized: false } : false;

  // Detect Netlify Functions / AWS Lambda serverless runtime
  const isServerless = Boolean(
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.CONTEXT
  );

  // In cloud poolers like Layerbase, prevent max_client_conn exhaustion
  const defaultMin = '0';
  const defaultMax = isServerless ? '1' : '3';
  const defaultIdle = isServerless ? '1000' : '10000';
  const connectionTimeoutMillis = parseInt(process.env.PGPOOL_CONNECT_TIMEOUT || '15000', 10);

  const poolMin = parseInt(process.env.PGPOOL_MIN || defaultMin, 10);
  const poolMax = parseInt(process.env.PGPOOL_MAX || defaultMax, 10);
  const idleTimeoutMillis = parseInt(process.env.PGPOOL_IDLE_TIMEOUT || defaultIdle, 10);

  const baseConfig = {
    ssl: sslConfig,
    min: poolMin,
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000
  };

  if (connectionString) {
    return {
      connectionString,
      ...baseConfig
    };
  }

  const host = process.env.PGHOST;
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;

  if (!host || !user || !database) {
    throw new Error(
      '[PostgreSQL] Missing database configuration. Set DATABASE_URL or PGHOST, PGUSER, PGDATABASE in .env'
    );
  }

  return {
    host,
    port,
    database,
    user,
    password,
    ...baseConfig
  };
}

/**
 * Safely prints connection target without exposing credentials.
 */
function getSafeConnectionSummary(config) {
  if (config.connectionString) {
    try {
      const url = new URL(config.connectionString);
      return `host: ${url.hostname}, port: ${url.port || 5432}, database: ${url.pathname.replace('/', '')}, ssl: true`;
    } catch {
      return 'URI connection configured (SSL enabled)';
    }
  }
  return `host: ${config.host}, port: ${config.port}, database: ${config.database}, ssl: ${Boolean(config.ssl)}`;
}

/**
 * Initializes the PostgreSQL connection pool with retry resilience.
 */
async function initPool() {
  if (pool) return pool;

  const config = buildPoolConfig();
  console.log(`[PostgreSQL] Initializing connection pool (${getSafeConnectionSummary(config)})...`);

  pool = new Pool(config);

  pool.on('error', (err) => {
    console.error('[PostgreSQL] Unexpected error on idle client:', err.message);
  });

  // Verify connection with retry resilience against transient network/pooler latency
  let connected = false;
  let lastErr = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client = null;
    try {
      client = await pool.connect();
      const res = await client.query('SELECT NOW() AS now, version() AS version');
      const versionStr = res.rows[0].version.split(' ')[0] + ' ' + res.rows[0].version.split(' ')[1];
      console.log(`[PostgreSQL] Connected successfully to ${versionStr}.`);
      connected = true;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        console.warn(`[PostgreSQL] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  if (!connected && lastErr) {
    throw lastErr;
  }

  // Ensure invoice columns & new accounting tables exist
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS reverse_charge VARCHAR(10) DEFAULT 'No';
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(200);
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS terms_conditions TEXT;

        CREATE TABLE IF NOT EXISTS financial_years (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          start_date VARCHAR(20) NOT NULL,
          end_date VARCHAR(20) NOT NULL,
          is_active BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO financial_years (name, start_date, end_date, is_active)
        VALUES 
          ('FY 2026-27', '2026-04-01', '2027-03-31', true)
        ON CONFLICT (name) DO NOTHING;

        CREATE TABLE IF NOT EXISTS bank_accounts (
          id SERIAL PRIMARY KEY,
          bank_name VARCHAR(150) NOT NULL,
          account_name VARCHAR(150) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          ifsc VARCHAR(50),
          branch VARCHAR(150),
          opening_balance NUMERIC(15,2) DEFAULT 0,
          opening_balance_type VARCHAR(10) DEFAULT 'Dr',
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_transfers (
          id SERIAL PRIMARY KEY,
          transfer_code VARCHAR(50) UNIQUE NOT NULL,
          date VARCHAR(20) NOT NULL,
          from_bank_id INTEGER REFERENCES bank_accounts(id),
          to_bank_id INTEGER REFERENCES bank_accounts(id),
          amount NUMERIC(15,2) NOT NULL,
          reference_no VARCHAR(100),
          remarks TEXT,
          created_by VARCHAR(100) DEFAULT 'Admin',
          is_voided INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS opening_balances (
          id SERIAL PRIMARY KEY,
          financial_year VARCHAR(50) NOT NULL,
          opening_date VARCHAR(20) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id INTEGER DEFAULT 0,
          quantity NUMERIC(15,2) DEFAULT 0,
          unit VARCHAR(20),
          rate NUMERIC(15,2) DEFAULT 0,
          amount NUMERIC(15,2) DEFAULT 0,
          balance_type VARCHAR(10) DEFAULT 'Dr',
          gsm INTEGER,
          size VARCHAR(50),
          remarks TEXT,
          created_by VARCHAR(100) DEFAULT 'Admin',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_opening_entity UNIQUE (financial_year, entity_type, entity_id)
        );

        CREATE TABLE IF NOT EXISTS debit_credit_notes (
          id SERIAL PRIMARY KEY,
          note_type VARCHAR(20) NOT NULL,
          note_code VARCHAR(50) UNIQUE NOT NULL,
          date VARCHAR(20) NOT NULL,
          party_type VARCHAR(20) NOT NULL,
          party_id INTEGER NOT NULL,
          reference_invoice VARCHAR(100),
          reason TEXT,
          taxable_amount NUMERIC(15,2) DEFAULT 0,
          gst_percent NUMERIC(5,2) DEFAULT 0,
          cgst_amount NUMERIC(15,2) DEFAULT 0,
          sgst_amount NUMERIC(15,2) DEFAULT 0,
          igst_amount NUMERIC(15,2) DEFAULT 0,
          total_amount NUMERIC(15,2) NOT NULL,
          remarks TEXT,
          created_by VARCHAR(100) DEFAULT 'Admin',
          is_voided INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expense_heads (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(200) NOT NULL,
          type VARCHAR(20) DEFAULT 'EXPENSE' NOT NULL,
          category VARCHAR(100) DEFAULT 'Direct Expense',
          status VARCHAR(20) DEFAULT 'active',
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO expense_heads (code, name, type, category, status, description)
        VALUES 
          ('EXP-000001', 'Electricity & Power Bill', 'EXPENSE', 'Direct Expense', 'active', 'Factory electricity and power supply expenses'),
          ('EXP-000002', 'Diesel & Fuel (Generator/Machinery)', 'EXPENSE', 'Direct Expense', 'active', 'Diesel and generator running expenses'),
          ('EXP-000003', 'Machine Maintenance & Spare Parts', 'EXPENSE', 'Direct Expense', 'active', 'Machine repair, servicing, and spare parts'),
          ('EXP-000004', 'Factory & Godown Rent', 'EXPENSE', 'Indirect Expense', 'active', 'Monthly factory/godown premises rent'),
          ('EXP-000005', 'Staff Welfare, Tea & Refreshments', 'EXPENSE', 'Indirect Expense', 'active', 'Staff tea, snacks, and daily refreshment expenses'),
          ('EXP-000006', 'Freight, Cartage & Transport', 'EXPENSE', 'Direct Expense', 'active', 'Incoming/outgoing goods transport charges'),
          ('EXP-000007', 'Office Stationery & Printing', 'EXPENSE', 'Indirect Expense', 'active', 'Office supplies, bill books, and print items'),
          ('EXP-000008', 'Other Miscellaneous Expense', 'EXPENSE', 'Indirect Expense', 'active', 'General misc daily operational expense'),
          ('INC-000001', 'Scrap & Waste Materials Sale', 'INCOME', 'Side Income', 'active', 'Revenue from sale of factory scrap, polymer waste, trims'),
          ('INC-000002', 'Other Miscellaneous / Side Income', 'INCOME', 'Side Income', 'active', 'Other side income, odd commission, interest')
        ON CONFLICT (code) DO NOTHING;

        ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_account_id INTEGER REFERENCES bank_accounts(id);

        ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT;
        ALTER TABLE managers ADD COLUMN IF NOT EXISTS permissions TEXT;

        ALTER TABLE raw_material_purchases ADD COLUMN IF NOT EXISTS el_charges TEXT DEFAULT '[]';
      `);
    } finally {
      client.release();
    }
  } catch (migErr) {
    console.warn('[PostgreSQL] Additional schema verification notice:', migErr.message);
  }

  await refreshCompanySettings();
  return pool;
}

/**
 * Returns active pool or initializes it.
 */
function getPool() {
  if (!pool) {
    throw new Error('[PostgreSQL] Pool not initialized. Call initPool() first.');
  }
  return pool;
}

/**
 * Gracefully shuts down the connection pool.
 */
async function closePool() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('[PostgreSQL] Connection pool closed.');
    } catch (err) {
      console.error('[PostgreSQL] Error closing pool:', err.message);
    }
  }
}

/**
 * SQL Translation for PostgreSQL:
 * 1. Translates SQLite/Oracle `?` placeholders into `$1, $2, $3...`
 * 2. Translates SQLite `INSERT OR REPLACE INTO settings ...` to PostgreSQL `ON CONFLICT (key) DO UPDATE`
 */
function translateSqlForPostgres(sql) {
  let translated = sql.trim();

  // SQLite INSERT OR REPLACE for settings table
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+settings/i.test(translated)) {
    translated = translated.replace(
      /INSERT\s+OR\s+REPLACE\s+INTO\s+settings\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
      'INSERT INTO settings ($1) VALUES ($2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP'
    );
  }

  // Replace ? placeholders with $1, $2, $3...
  let paramIdx = 1;
  translated = translated.replace(/\?/g, () => `$${paramIdx++}`);

  return translated;
}

/**
 * Executes a query using either an active client (inside transaction) or the pool.
 */
async function executeQuery(clientOrPool, sql, binds = []) {
  const executor = clientOrPool || getPool();
  const normBinds = Array.isArray(binds) ? binds : Object.values(binds);
  return executor.query(sql, normBinds);
}

/**
 * Runs a transactional block. Commits on success, rolls back on error.
 */
async function runTransaction(callback) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Formats a PostgreSQL row for JSON output. Converts timestamp Date objects to ISO strings.
 */
function formatRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase();
    if (v instanceof Date) {
      out[key] = v.toISOString();
    } else {
      out[key] = v;
    }
  }
  return out;
}

function formatRows(rows) {
  if (!rows) return [];
  return rows.map(formatRow);
}

// ─── QUERY HELPERS ───────────────────────────────────────────────────────────

async function queryAll(sql, binds = [], client = null) {
  const pgSql = translateSqlForPostgres(sql);
  const result = await executeQuery(client, pgSql, binds);
  return formatRows(result.rows);
}

async function queryOne(sql, binds = [], client = null) {
  const pgSql = translateSqlForPostgres(sql);
  const result = await executeQuery(client, pgSql, binds);
  return (result.rows && result.rows.length > 0) ? formatRow(result.rows[0]) : null;
}

async function executeRun(sql, binds = [], client = null) {
  let pgSql = translateSqlForPostgres(sql);

  // For INSERT statements, append RETURNING id if not already returning
  const isInsert = /^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i.exec(sql);
  let shouldReturnId = false;

  if (isInsert && !/RETURNING\s+/i.test(pgSql)) {
    const tableName = isInsert[1].toLowerCase();
    if (tableName !== 'settings') {
      shouldReturnId = true;
      pgSql += ' RETURNING id';
    }
  }

  const result = await executeQuery(client, pgSql, binds);
  let lastInsertRowid = null;
  if (shouldReturnId && result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
    lastInsertRowid = Number(result.rows[0].id);
  }

  return {
    lastInsertRowid,
    changes: result.rowCount || 0
  };
}

// ─── BUSINESS CODE GENERATION ────────────────────────────────────────────────

async function getNextCode(prefix, table, column, client = null) {
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
  const safeColumn = column.replace(/[^a-zA-Z0-9_]/g, '');

  const checkSql = `
    SELECT ${safeColumn} AS code
    FROM ${safeTable}
    WHERE ${safeColumn} LIKE $1
    ORDER BY id DESC
    LIMIT 1
  `;
  const row = await queryOne(checkSql, [`${prefix}-%`], client);

  let nextNum = 1;
  if (row && row.code) {
    const match = row.code.match(/(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  while (true) {
    const candidate = `${prefix}-${String(nextNum).padStart(6, '0')}`;
    const exists = await queryOne(`SELECT id FROM ${safeTable} WHERE ${safeColumn} = $1`, [candidate], client);
    if (!exists) {
      return candidate;
    }
    nextNum++;
  }
}

// ─── STOCK HELPERS ───────────────────────────────────────────────────────────

async function getRawMaterialStock(rawMaterialId, client = null) {
  const row = await queryOne(
    `SELECT COALESCE(SUM(quantity_change), 0) AS stock
     FROM raw_material_movements
     WHERE raw_material_id = $1`,
    [rawMaterialId],
    client
  );
  return Number(row ? row.stock : 0);
}

async function getFinishedGoodStock(finishedProductId, client = null) {
  const row = await queryOne(
    `SELECT COALESCE(SUM(quantity_change), 0) AS stock
     FROM finished_goods_movements
     WHERE finished_product_id = $1`,
    [finishedProductId],
    client
  );
  return Number(row ? row.stock : 0);
}

// ─── AUTH HELPERS ────────────────────────────────────────────────────────────

async function getUserByToken(token, client = null) {
  if (!token) return null;
  return queryOne('SELECT * FROM users WHERE session_token = $1', [token], client);
}

async function getManagerByToken(token, client = null) {
  if (!token) return null;
  return queryOne('SELECT * FROM managers WHERE manager_token = $1', [token], client);
}

// ─── COMPANY SETTINGS ────────────────────────────────────────────────────────

const defaultCompanySettings = {
  company_name:       'TRIPAL MANUFACTURING PVT. LTD.',
  companyName:        'TRIPAL MANUFACTURING PVT. LTD.',
  company_address:    'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445',
  address:            'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445',
  company_gstin:      '24AAACT1234F1Z5',
  gstNumber:          '24AAACT1234F1Z5',
  company_state:      'Gujarat',
  state:              'Gujarat',
  company_state_code: '24',
  stateCode:          '24',
  company_phone:      '+91 79 2583 0000',
  phone:              '+91 79 2583 0000',
  company_email:      'accounts@tripalmanufacturing.com',
  email:              'accounts@tripalmanufacturing.com',
  city:               'Ahmedabad',
  pincode:            '382445',
  bank_name:          'State Bank of India',
  bankName:           'State Bank of India',
  bank_account_no:    '382910482910',
  bankAccountNo:      '382910482910',
  bank_ifsc:          'SBIN0001234',
  bankIfsc:           'SBIN0001234',
  bank_branch:        'Vatva Industrial Estate Branch',
  bankBranch:         'Vatva Industrial Estate Branch'
};

async function refreshCompanySettings(client = null) {
  try {
    const rows = await queryAll('SELECT key, value FROM settings', [], client);
    const s = {};
    if (rows && Array.isArray(rows)) {
      for (const r of rows) {
        const k = (r.key || '').toLowerCase();
        s[k] = r.value;
      }
    }
    cachedCompanySettings = {
      company_name:       s.company_name       || defaultCompanySettings.company_name,
      companyName:        s.company_name       || defaultCompanySettings.company_name,
      company_address:    s.company_address    || defaultCompanySettings.company_address,
      address:            s.company_address    || defaultCompanySettings.company_address,
      company_gstin:      s.company_gstin      || defaultCompanySettings.company_gstin,
      gstNumber:          s.company_gstin      || defaultCompanySettings.company_gstin,
      company_state:      s.company_state      || defaultCompanySettings.company_state,
      state:              s.company_state      || defaultCompanySettings.company_state,
      company_state_code: s.company_state_code || defaultCompanySettings.company_state_code,
      stateCode:          s.company_state_code || defaultCompanySettings.company_state_code,
      company_phone:      s.company_phone      || defaultCompanySettings.company_phone,
      phone:              s.company_phone      || defaultCompanySettings.company_phone,
      company_email:      s.company_email      || defaultCompanySettings.company_email,
      email:              s.company_email      || defaultCompanySettings.company_email,
      city:               s.company_city       || defaultCompanySettings.city,
      pincode:            s.company_pincode    || defaultCompanySettings.pincode,
      bank_name:          s.bank_name          || defaultCompanySettings.bank_name,
      bankName:           s.bank_name          || defaultCompanySettings.bank_name,
      bank_account_no:    s.bank_account_no    || defaultCompanySettings.bank_account_no,
      bankAccountNo:      s.bank_account_no    || defaultCompanySettings.bank_account_no,
      bank_ifsc:          s.bank_ifsc          || defaultCompanySettings.bank_ifsc,
      bankIfsc:           s.bank_ifsc          || defaultCompanySettings.bank_ifsc,
      bank_branch:        s.bank_branch        || defaultCompanySettings.bank_branch,
      bankBranch:         s.bank_branch        || defaultCompanySettings.bank_branch
    };
  } catch (err) {
    cachedCompanySettings = { ...defaultCompanySettings };
  }
  return cachedCompanySettings;
}

function getCompanySettings() {
  return cachedCompanySettings || { ...defaultCompanySettings };
}

module.exports = {
  initPool,
  closePool,
  getPool,
  runTransaction,
  queryAll,
  queryOne,
  executeRun,
  translateSqlForPostgres,
  getNextCode,
  getRawMaterialStock,
  getFinishedGoodStock,
  getUserByToken,
  getManagerByToken,
  getCompanySettings,
  refreshCompanySettings
};
