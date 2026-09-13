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
    process.env.LAMBDA_TASK_ROOT
  );

  // In serverless, minimize idle connections and cap max pool per lambda to prevent exhaustion
  const defaultMin = isServerless ? '0' : '1';
  const defaultMax = isServerless ? '3' : '10';
  const defaultIdle = isServerless ? '10000' : '30000';

  const poolMin = parseInt(process.env.PGPOOL_MIN || defaultMin, 10);
  const poolMax = parseInt(process.env.PGPOOL_MAX || defaultMax, 10);
  const idleTimeoutMillis = parseInt(process.env.PGPOOL_IDLE_TIMEOUT || defaultIdle, 10);
  // Default connection timeout to 30s to withstand remote cloud pooler handshake latency
  const connectionTimeoutMillis = parseInt(process.env.PGPOOL_CONNECT_TIMEOUT || '30000', 10);

  const baseConfig = {
    ssl: sslConfig,
    min: poolMin,
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
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
