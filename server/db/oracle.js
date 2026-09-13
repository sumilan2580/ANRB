'use strict';

/**
 * TRIPAL ERP — Oracle Database Abstraction Layer
 * Replaces the SQLite-based server/db.js completely.
 *
 * Uses the official oracledb Node.js driver with connection pooling.
 * All public functions are async/await compatible.
 *
 * Environment variables required (see .env.example):
 *   ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING,
 *   ORACLE_WALLET_LOCATION, ORACLE_WALLET_PASSWORD
 */

const oracledb = require('oracledb');
const path = require('path');

// ─── Load .env ────────────────────────────────────────────────────────────────
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// ─── Oracle Thick Mode (required for Autonomous DB Wallet) ───────────────────
// Must be called before any pool/connection is created.
// Thick mode is required when using wallet-based mTLS connections.
try {
  oracledb.initOracleClient();
} catch (e) {
  // Already initialized, or thin mode — log but do not crash
  if (!e.message.includes('already been initialized')) {
    console.warn('[OracleDB] initOracleClient notice:', e.message);
  }
}

// ─── Global Pool ─────────────────────────────────────────────────────────────
let pool = null;

/**
 * Build Oracle connection attributes from environment variables.
 * Supports both wallet-based (Autonomous DB) and plain TCP connections.
 */
function buildConnectConfig() {
  const user            = process.env.ORACLE_USER;
  const password        = process.env.ORACLE_PASSWORD;
  const connectString   = process.env.ORACLE_CONNECT_STRING;
  const walletLocation  = process.env.ORACLE_WALLET_LOCATION;
  const walletPassword  = process.env.ORACLE_WALLET_PASSWORD;

  if (!user || !password || !connectString) {
    throw new Error(
      'Oracle environment variables missing. ' +
      'Set ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING in your .env file.'
    );
  }

  const config = {
    user,
    password,
    connectString,
    poolMin:       parseInt(process.env.ORACLE_POOL_MIN       || '1',  10),
    poolMax:       parseInt(process.env.ORACLE_POOL_MAX       || '5',  10),
    poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT || '1',  10),
    poolTimeout:   parseInt(process.env.ORACLE_POOL_TIMEOUT   || '60', 10),
    stmtCacheSize: 30,
    queueTimeout:  60000
  };

  // Wallet-based connection (Oracle Autonomous DB Always Free)
  if (walletLocation) {
    config.walletLocation = walletLocation;
    if (walletPassword) {
      config.walletPassword = walletPassword;
    }
    // Ensure sqlnet.ora and tnsnames.ora inside the wallet dir are found
    config.connectionClass = 'TRIPAL_ERP';
  }

  return config;
}

/**
 * Initialize the Oracle connection pool.
 * Must be called once at application startup (before any queries).
 */
async function initPool() {
  if (pool) return pool;

  const config = buildConnectConfig();
  console.log(`[OracleDB] Connecting as ${config.user} to ${config.connectString} ...`);

  pool = await oracledb.createPool(config);
  console.log('[OracleDB] Connection pool created successfully.');

  // Default fetch type: Buffers → strings for CLOB; Numbers → JS numbers
  oracledb.fetchAsString = [oracledb.CLOB];

  return pool;
}

/**
 * Gracefully close the Oracle connection pool.
 * Call during process shutdown (SIGTERM / SIGINT).
 */
async function closePool() {
  if (pool) {
    try {
      await pool.close(10); // 10-second drain timeout
      pool = null;
      console.log('[OracleDB] Connection pool closed.');
    } catch (err) {
      console.error('[OracleDB] Error closing pool:', err.message);
    }
  }
}

/**
 * Execute a single SQL statement.
 *
 * @param {string} sql      - Oracle SQL with :param named binds
 * @param {object|Array} binds - Named bind object or positional array
 * @param {object} opts     - oracledb execute options
 * @returns {Promise<object>} - Oracle execute result
 */
async function executeQuery(sql, binds = {}, opts = {}) {
  if (!pool) throw new Error('[OracleDB] Pool not initialized. Call initPool() first.');

  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: opts.autoCommit !== undefined ? opts.autoCommit : true,
      ...opts
    });
    return result;
  } finally {
    await conn.close();
  }
}

/**
 * Execute multiple SQL statements within a single connection
 * (used for batch inserts that need the same connection context).
 *
 * @param {Function} callback - async (conn) => { ... }
 * @returns {Promise<any>}
 */
async function withConnection(callback) {
  if (!pool) throw new Error('[OracleDB] Pool not initialized. Call initPool() first.');
  const conn = await pool.getConnection();
  try {
    return await callback(conn);
  } finally {
    await conn.close();
  }
}

/**
 * Execute a transaction: if callback throws, ROLLBACK; else COMMIT.
 *
 * @param {Function} callback - async (conn) => { return result; }
 * @returns {Promise<any>} - whatever the callback returns
 */
async function runTransaction(callback) {
  if (!pool) throw new Error('[OracleDB] Pool not initialized. Call initPool() first.');
  const conn = await pool.getConnection();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Generate the next sequential business code (e.g. PUR-000001).
 * Thread-safe via database query (no in-memory counter).
 *
 * @param {string} prefix  - e.g. 'PUR', 'SALE', 'INV-2026'
 * @param {string} table   - table name
 * @param {string} column  - column name that holds the code
 * @returns {Promise<string>}
 */
async function getNextCode(prefix, table, column) {
  // Sanitize table and column names (prevent injection — they come from internal code only)
  const safeTable  = table.replace(/[^a-zA-Z0-9_]/g, '');
  const safeColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
  const safePrefix = prefix.replace(/'/g, '');

  const sql = `
    SELECT MAX(TO_NUMBER(REGEXP_SUBSTR(${safeColumn}, '[0-9]+$'))) AS max_num
    FROM   ${safeTable}
    WHERE  ${safeColumn} LIKE :prefix
  `;
  const result = await executeQuery(sql, { prefix: `${safePrefix}-%` });
  const maxNum = (result.rows && result.rows[0] && result.rows[0].MAX_NUM)
    ? Number(result.rows[0].MAX_NUM)
    : 0;

  let nextNum = maxNum + 1;

  // Collision guard (should be rare in practice)
  while (true) {
    const candidate = `${safePrefix}-${String(nextNum).padStart(6, '0')}`;
    const check = await executeQuery(
      `SELECT COUNT(*) AS cnt FROM ${safeTable} WHERE ${safeColumn} = :code`,
      { code: candidate }
    );
    const cnt = check.rows[0].CNT;
    if (cnt === 0) return candidate;
    nextNum++;
  }
}

/**
 * Get current stock balance for a raw material.
 * @param {number} rawMaterialId
 * @returns {Promise<number>}
 */
async function getRawMaterialStock(rawMaterialId) {
  const result = await executeQuery(
    `SELECT NVL(SUM(quantity_change), 0) AS stock
     FROM   raw_material_movements
     WHERE  raw_material_id = :id`,
    { id: rawMaterialId }
  );
  return Number(result.rows[0].STOCK || 0);
}

/**
 * Get current stock balance for a finished good.
 * @param {number} finishedProductId
 * @returns {Promise<number>}
 */
async function getFinishedGoodStock(finishedProductId) {
  const result = await executeQuery(
    `SELECT NVL(SUM(quantity_change), 0) AS stock
     FROM   finished_goods_movements
     WHERE  finished_product_id = :id`,
    { id: finishedProductId }
  );
  return Number(result.rows[0].STOCK || 0);
}

/**
 * Look up a web session user by Bearer token.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function getUserByToken(token) {
  if (!token) return null;
  const result = await executeQuery(
    `SELECT * FROM users WHERE session_token = :token`,
    { token }
  );
  return (result.rows && result.rows.length > 0) ? result.rows[0] : null;
}

/**
 * Look up a legacy manager by their APK-issued token.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function getManagerByToken(token) {
  if (!token) return null;
  const result = await executeQuery(
    `SELECT * FROM managers WHERE manager_token = :token`,
    { token }
  );
  return (result.rows && result.rows.length > 0) ? result.rows[0] : null;
}

/**
 * Retrieve all company settings as a flat object.
 * @returns {Promise<object>}
 */
async function getCompanySettings() {
  const result = await executeQuery(
    `SELECT key, value FROM settings`,
    {},
    { autoCommit: true }
  );
  const s = {};
  if (result.rows) {
    for (const row of result.rows) {
      s[row.KEY] = row.VALUE;
    }
  }
  return {
    company_name:       s.company_name       || 'TRIPAL MANUFACTURING PVT. LTD.',
    companyName:        s.company_name       || 'TRIPAL MANUFACTURING PVT. LTD.',
    company_address:    s.company_address    || 'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445',
    address:            s.company_address    || 'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445',
    company_gstin:      s.company_gstin      || '24AAACT1234F1Z5',
    gstNumber:          s.company_gstin      || '24AAACT1234F1Z5',
    company_state:      s.company_state      || 'Gujarat',
    state:              s.company_state      || 'Gujarat',
    company_state_code: s.company_state_code || '24',
    stateCode:          s.company_state_code || '24',
    company_phone:      s.company_phone      || '+91 79 2583 0000',
    phone:              s.company_phone      || '+91 79 2583 0000',
    company_email:      s.company_email      || 'accounts@tripalmanufacturing.com',
    email:              s.company_email      || 'accounts@tripalmanufacturing.com',
    city:               s.company_city       || 'Ahmedabad',
    pincode:            s.company_pincode    || '382445',
    bank_name:          s.bank_name          || 'State Bank of India',
    bankName:           s.bank_name          || 'State Bank of India',
    bank_account_no:    s.bank_account_no    || '382910482910',
    bankAccountNo:      s.bank_account_no    || '382910482910',
    bank_ifsc:          s.bank_ifsc          || 'SBIN0001234',
    bankIfsc:           s.bank_ifsc          || 'SBIN0001234',
    bank_branch:        s.bank_branch        || 'Vatva Industrial Estate Branch',
    bankBranch:         s.bank_branch        || 'Vatva Industrial Estate Branch',
  };
}

/**
 * Upsert a setting key-value pair (MERGE INTO — Oracle equivalent of INSERT OR REPLACE).
 * @param {object} conn  - Oracle connection (within a transaction)
 * @param {string} key
 * @param {string} value
 */
async function upsertSetting(conn, key, value) {
  await conn.execute(
    `MERGE INTO settings tgt
     USING (SELECT :k AS key FROM dual) src
     ON (tgt.key = src.key)
     WHEN MATCHED THEN
       UPDATE SET value = :v, updated_at = SYSTIMESTAMP
     WHEN NOT MATCHED THEN
       INSERT (key, value, updated_at) VALUES (:k2, :v2, SYSTIMESTAMP)`,
    { k: key, v: value, k2: key, v2: value },
    { autoCommit: false }
  );
}

/**
 * Format Oracle TIMESTAMP rows for JSON output.
 * Oracle returns Date objects for TIMESTAMP columns; convert to ISO strings.
 * @param {object} row
 * @returns {object}
 */
function formatRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase(); // Oracle returns uppercase column names
    if (v instanceof Date) {
      out[key] = v.toISOString();
    } else {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Format an array of Oracle rows (lowercases column names, converts Dates).
 * @param {Array} rows
 * @returns {Array}
 */
function formatRows(rows) {
  if (!rows) return [];
  return rows.map(formatRow);
}

/**
 * Execute a SELECT query and return all rows as formatted JS objects.
 * @param {string} sql
 * @param {object} binds
 * @returns {Promise<Array>}
 */
async function queryAll(sql, binds = {}) {
  const result = await executeQuery(sql, binds);
  return formatRows(result.rows);
}

/**
 * Execute a SELECT query and return the first row or null.
 * @param {string} sql
 * @param {object} binds
 * @returns {Promise<object|null>}
 */
async function queryOne(sql, binds = {}) {
  const result = await executeQuery(sql, binds);
  return (result.rows && result.rows.length > 0) ? formatRow(result.rows[0]) : null;
}

/**
 * Execute a SELECT query within an open connection (inside a transaction).
 * @param {object} conn
 * @param {string} sql
 * @param {object} binds
 * @returns {Promise<Array>}
 */
async function connQueryAll(conn, sql, binds = {}) {
  const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false });
  return formatRows(result.rows);
}

/**
 * Execute a SELECT query within an open connection, returning first row.
 * @param {object} conn
 * @param {string} sql
 * @param {object} binds
 * @returns {Promise<object|null>}
 */
async function connQueryOne(conn, sql, binds = {}) {
  const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false });
  return (result.rows && result.rows.length > 0) ? formatRow(result.rows[0]) : null;
}

/**
 * Execute a DML (INSERT/UPDATE/DELETE) within an open connection.
 * Returns the execute result (including outBinds for RETURNING INTO).
 * @param {object} conn
 * @param {string} sql
 * @param {object} binds
 * @returns {Promise<object>}
 */
async function connExecute(conn, sql, binds = {}) {
  return conn.execute(sql, binds, { autoCommit: false });
}

/**
 * Get the next business code within an open connection (inside a transaction).
 * @param {object} conn
 * @param {string} prefix
 * @param {string} table
 * @param {string} column
 * @returns {Promise<string>}
 */
async function connGetNextCode(conn, prefix, table, column) {
  const safeTable  = table.replace(/[^a-zA-Z0-9_]/g, '');
  const safeColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
  const safePrefix = prefix.replace(/'/g, '');

  const result = await conn.execute(
    `SELECT MAX(TO_NUMBER(REGEXP_SUBSTR(${safeColumn}, '[0-9]+$'))) AS max_num
     FROM   ${safeTable}
     WHERE  ${safeColumn} LIKE :prefix`,
    { prefix: `${safePrefix}-%` },
    { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
  );
  const maxNum = (result.rows && result.rows[0] && result.rows[0].MAX_NUM)
    ? Number(result.rows[0].MAX_NUM)
    : 0;

  let nextNum = maxNum + 1;

  // Collision guard
  while (true) {
    const candidate = `${safePrefix}-${String(nextNum).padStart(6, '0')}`;
    const check = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM ${safeTable} WHERE ${safeColumn} = :code`,
      { code: candidate },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );
    if (Number(check.rows[0].CNT) === 0) return candidate;
    nextNum++;
  }
}

/**
 * Get RM stock within an open connection.
 * @param {object} conn
 * @param {number} rawMaterialId
 * @returns {Promise<number>}
 */
async function connGetRawMaterialStock(conn, rawMaterialId) {
  const result = await conn.execute(
    `SELECT NVL(SUM(quantity_change), 0) AS stock
     FROM   raw_material_movements
     WHERE  raw_material_id = :id`,
    { id: rawMaterialId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
  );
  return Number(result.rows[0].STOCK || 0);
}

/**
 * Get FG stock within an open connection.
 * @param {object} conn
 * @param {number} finishedProductId
 * @returns {Promise<number>}
 */
async function connGetFinishedGoodStock(conn, finishedProductId) {
  const result = await conn.execute(
    `SELECT NVL(SUM(quantity_change), 0) AS stock
     FROM   finished_goods_movements
     WHERE  finished_product_id = :id`,
    { id: finishedProductId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
  );
  return Number(result.rows[0].STOCK || 0);
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  // Pool lifecycle
  initPool,
  closePool,

  // Query helpers
  executeQuery,
  withConnection,
  runTransaction,
  queryAll,
  queryOne,

  // Connection-scoped helpers (for use inside runTransaction callbacks)
  connQueryAll,
  connQueryOne,
  connExecute,
  connGetNextCode,
  connGetRawMaterialStock,
  connGetFinishedGoodStock,

  // Business helpers
  getNextCode,
  getRawMaterialStock,
  getFinishedGoodStock,
  getUserByToken,
  getManagerByToken,
  getCompanySettings,
  upsertSetting,

  // Formatting
  formatRow,
  formatRows,

  // oracledb ref for CLOB/BLOB type constants etc.
  oracledb
};
