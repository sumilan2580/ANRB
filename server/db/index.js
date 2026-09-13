'use strict';

/**
 * TRIPAL ERP — Unified Database Facade
 * 
 * Supports:
 *   1. Layerbase PostgreSQL (Primary Active Production Database)
 *      via official `pg` package with connection pooling & TLS/SSL.
 *   2. Oracle Autonomous AI Database (Preserved Integration)
 *      via official `oracledb` package with connection pooling & transaction management.
 *   3. SQLite (Local development / offline testing fallback)
 *      via Node.js 22 `node:sqlite` DatabaseSync.
 * 
 * All engines provide the exact same async interface:
 *   - db.prepare(sql).all(...binds)
 *   - db.prepare(sql).get(...binds)
 *   - db.prepare(sql).run(...binds)
 *   - db.all(sql, ...binds)
 *   - db.get(sql, ...binds)
 *   - db.run(sql, ...binds)
 *   - runTransaction(async (conn) => { ... })
 *   - getNextCode(prefix, table, column)
 *   - getRawMaterialStock(id)
 *   - getFinishedGoodStock(id)
 *   - getUserByToken(token)
 *   - getManagerByToken(token)
 *   - getCompanySettings()
 */

const path = require('path');
const { AsyncLocalStorage } = require('node:async_hooks');

// Load .env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const asyncLocalStorage = new AsyncLocalStorage();

// Engine Detection
const isExplicitSqlite = process.env.DB_CLIENT === 'sqlite';
const isExplicitOracle = process.env.DB_CLIENT === 'oracle';

const isPostgresConfigured = Boolean(
  !isExplicitSqlite &&
  !isExplicitOracle &&
  (process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE))
);

const isOracleConfigured = Boolean(
  !isPostgresConfigured &&
  !isExplicitSqlite &&
  (isExplicitOracle || Boolean(process.env.ORACLE_USER && process.env.ORACLE_PASSWORD && process.env.ORACLE_CONNECT_STRING))
);

let postgresModule = null;
let oracleModule = null;
let sqliteDb = null;
let cachedCompanySettings = null;

// =============================================================================
// POSTGRESQL INITIALIZATION
// =============================================================================
function getPostgresModule() {
  if (!postgresModule) {
    postgresModule = require('./postgres');
  }
  return postgresModule;
}

// Production safety: Disallow SQLite fallback when deployed in production or Netlify
function assertProductionDbConfigured() {
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isProduction && !isPostgresConfigured && !isOracleConfigured) {
    throw new Error('[DB] FATAL: Production requires Layerbase PostgreSQL (DATABASE_URL). SQLite is strictly prohibited in production.');
  }
}

// =============================================================================
// SQLITE FALLBACK INITIALIZATION (Local Development Only)
// =============================================================================
function getSqliteDb() {
  assertProductionDbConfigured();
  if (sqliteDb) return sqliteDb;
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.resolve(__dirname, '../../tripal_erp.sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  return sqliteDb;
}

// =============================================================================
// ORACLE INITIALIZATION
// =============================================================================
function getOracleModule() {
  if (!oracleModule) {
    oracleModule = require('./oracle');
  }
  return oracleModule;
}

// =============================================================================
// DATABASE INITIALIZATION (Called at server startup)
// =============================================================================
async function init() {
  if (isPostgresConfigured) {
    console.log('[DB] Initializing Layerbase PostgreSQL connection pool...');
    const pg = getPostgresModule();
    await pg.initPool();
    console.log('[DB] Layerbase PostgreSQL ready as active production database.');
  } else if (isOracleConfigured) {
    console.log('[DB] Initializing Oracle Autonomous Database connection pool...');
    const ora = getOracleModule();
    await ora.initPool();
    console.log('[DB] Oracle Database ready as production database.');
  } else {
    assertProductionDbConfigured();
    console.log('[DB] Notice: Layerbase PostgreSQL / Oracle credentials not configured or DB_CLIENT=sqlite.');
    console.log('[DB] Running with SQLite (tripal_erp.sqlite) for local development.');
    getSqliteDb();
  }
  await refreshCompanySettings();
}

async function close() {
  if (isPostgresConfigured && postgresModule) {
    await postgresModule.closePool();
  } else if (isOracleConfigured && oracleModule) {
    await oracleModule.closePool();
  }
}

// =============================================================================
// ARGUMENT NORMALIZATION & SQL TRANSLATION
// =============================================================================
function normalizeArgs(args) {
  if (!args || args.length === 0) return [];
  if (args.length === 1) {
    if (Array.isArray(args[0])) return [...args[0]];
    if (typeof args[0] === 'object' && args[0] !== null && !(args[0] instanceof Date)) {
      return { ...args[0] };
    }
    return [args[0]];
  }
  return [...args];
}

function translateSqlForOracle(sql) {
  let translated = sql.trim();

  // Replace ? with :1, :2, :3...
  let paramIdx = 1;
  translated = translated.replace(/\?/g, () => `:${paramIdx++}`);

  // Replace LIMIT N with FETCH FIRST N ROWS ONLY
  translated = translated.replace(/\bLIMIT\s+(\d+)\b/gi, 'FETCH FIRST $1 ROWS ONLY');

  // Replace date(col) with TRUNC(col)
  translated = translated.replace(/\bdate\(([^)]+)\)/gi, 'TRUNC($1)');

  // Replace datetime('now') with SYSTIMESTAMP
  translated = translated.replace(/\bdatetime\('now'\)/gi, 'SYSTIMESTAMP');

  return translated;
}

// =============================================================================
// EXECUTION HELPERS
// =============================================================================
async function executeAll(sql, binds) {
  const store = asyncLocalStorage.getStore();

  if (isPostgresConfigured) {
    const pg = getPostgresModule();
    const client = (store && store.pgClient) ? store.pgClient : null;
    return pg.queryAll(sql, binds, client);
  } else if (isOracleConfigured) {
    const ora = getOracleModule();
    const oraSql = translateSqlForOracle(sql);

    if (store && store.conn) {
      return ora.connQueryAll(store.conn, oraSql, binds);
    }
    return ora.queryAll(oraSql, binds);
  } else {
    const sdb = getSqliteDb();
    const norm = Array.isArray(binds) ? binds : Object.values(binds);
    return sdb.prepare(sql).all(...norm);
  }
}

async function executeGet(sql, binds) {
  const store = asyncLocalStorage.getStore();

  if (isPostgresConfigured) {
    const pg = getPostgresModule();
    const client = (store && store.pgClient) ? store.pgClient : null;
    return pg.queryOne(sql, binds, client);
  } else if (isOracleConfigured) {
    const ora = getOracleModule();
    const oraSql = translateSqlForOracle(sql);

    if (store && store.conn) {
      return ora.connQueryOne(store.conn, oraSql, binds);
    }
    return ora.queryOne(oraSql, binds);
  } else {
    const sdb = getSqliteDb();
    const norm = Array.isArray(binds) ? binds : Object.values(binds);
    const row = sdb.prepare(sql).get(...norm);
    return row !== undefined ? row : null;
  }
}

async function executeRun(sql, binds) {
  const store = asyncLocalStorage.getStore();

  if (isPostgresConfigured) {
    const pg = getPostgresModule();
    const client = (store && store.pgClient) ? store.pgClient : null;
    return pg.executeRun(sql, binds, client);
  } else if (isOracleConfigured) {
    const ora = getOracleModule();
    const oracledb = ora.oracledb;
    let oraSql = translateSqlForOracle(sql);

    // Check if it is an INSERT into a table that has an 'id' identity column
    const isInsert = /^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i.exec(sql);
    let isIdentityInsert = false;
    let outBindVar = null;

    if (isInsert && !/RETURNING\s+/i.test(oraSql)) {
      const tableName = isInsert[1].toLowerCase();
      if (tableName !== 'settings') {
        isIdentityInsert = true;
      }
    }

    let finalBinds = Array.isArray(binds) ? [...binds] : { ...binds };

    if (isIdentityInsert) {
      if (Array.isArray(finalBinds)) {
        finalBinds.push({ dir: oracledb.BIND_OUT, type: oracledb.NUMBER });
        const outIdx = finalBinds.length;
        oraSql += ` RETURNING id INTO :${outIdx}`;
      } else {
        finalBinds['out_id'] = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
        oraSql += ` RETURNING id INTO :out_id`;
        outBindVar = 'out_id';
      }
    }

    let result;
    if (store && store.conn) {
      result = await ora.connExecute(store.conn, oraSql, finalBinds);
    } else {
      result = await ora.executeQuery(oraSql, finalBinds, { autoCommit: true });
    }

    let lastInsertRowid = null;
    if (result.outBinds) {
      if (outBindVar && result.outBinds[outBindVar] && result.outBinds[outBindVar].length > 0) {
        lastInsertRowid = Number(result.outBinds[outBindVar][0]);
      } else if (Array.isArray(result.outBinds)) {
        const last = result.outBinds[result.outBinds.length - 1];
        if (Array.isArray(last) && last.length > 0) {
          lastInsertRowid = Number(last[0]);
        }
      }
    }

    return {
      lastInsertRowid,
      changes: result.rowsAffected || 0
    };
  } else {
    const sdb = getSqliteDb();
    const norm = Array.isArray(binds) ? binds : Object.values(binds);
    const info = sdb.prepare(sql).run(...norm);
    return {
      lastInsertRowid: Number(info.lastInsertRowid),
      changes: info.changes
    };
  }
}

// =============================================================================
// PREPARED STATEMENT DESCRIPTOR
// =============================================================================
function prepare(sql) {
  return {
    sql,
    all: async (...args) => executeAll(sql, normalizeArgs(args)),
    get: async (...args) => executeGet(sql, normalizeArgs(args)),
    run: async (...args) => executeRun(sql, normalizeArgs(args))
  };
}

// =============================================================================
// TRANSACTION RUNNER
// =============================================================================
async function runTransaction(callback) {
  const existingStore = asyncLocalStorage.getStore();

  if (isPostgresConfigured) {
    const pg = getPostgresModule();
    if (existingStore && existingStore.pgClient) {
      return callback(existingStore.pgClient);
    }
    return pg.runTransaction(async (client) => {
      return asyncLocalStorage.run({ pgClient: client, isTransaction: true }, async () => {
        return callback(client);
      });
    });
  } else if (isOracleConfigured) {
    const ora = getOracleModule();
    if (existingStore && existingStore.conn) {
      return callback(existingStore.conn);
    }
    return ora.runTransaction(async (conn) => {
      return asyncLocalStorage.run({ conn, isTransaction: true }, async () => {
        return callback(conn);
      });
    });
  } else {
    const sdb = getSqliteDb();
    if (existingStore && existingStore.isTransaction) {
      return callback(sdb);
    }

    sdb.exec('BEGIN TRANSACTION;');
    try {
      const result = await asyncLocalStorage.run({ sdb, isTransaction: true }, async () => {
        return callback(sdb);
      });
      sdb.exec('COMMIT;');
      return result;
    } catch (err) {
      try { sdb.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }
  }
}

// =============================================================================
// BUSINESS CODE GENERATION & STOCK HELPERS
// =============================================================================
async function getNextCode(prefix, table, column) {
  const store = asyncLocalStorage.getStore();

  if (isPostgresConfigured) {
    const pg = getPostgresModule();
    const client = (store && store.pgClient) ? store.pgClient : null;
    return pg.getNextCode(prefix, table, column, client);
  }

  if (isOracleConfigured) {
    const ora = getOracleModule();
    if (store && store.conn) {
      return ora.connGetNextCode(store.conn, prefix, table, column);
    }
    return ora.getNextCode(prefix, table, column);
  }

  // SQLite implementation
  const sdb = getSqliteDb();
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
  const safeColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
  const prefixEscaped = prefix.replace(/'/g, "''");

  const row = sdb.prepare(`
    SELECT ${safeColumn} as code
    FROM ${safeTable}
    WHERE ${safeColumn} LIKE '${prefixEscaped}-%'
    ORDER BY id DESC
    LIMIT 1
  `).get();

  let nextNum = 1;
  if (row && row.code) {
    const match = row.code.match(/(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  while (true) {
    const candidate = `${prefix}-${String(nextNum).padStart(6, '0')}`;
    const exists = sdb.prepare(`SELECT id FROM ${safeTable} WHERE ${safeColumn} = ?`).get(candidate);
    if (!exists) {
      return candidate;
    }
    nextNum++;
  }
}

async function getRawMaterialStock(rawMaterialId) {
  const store = asyncLocalStorage.getStore();

  if (isPostgresConfigured) {
    const pg = getPostgresModule();
    const client = (store && store.pgClient) ? store.pgClient : null;
    return pg.getRawMaterialStock(rawMaterialId, client);
  }

  if (isOracleConfigured) {
    const ora = getOracleModule();
    if (store && store.conn) {
      return ora.connGetRawMaterialStock(store.conn, rawMaterialId);
    }
    return ora.getRawMaterialStock(rawMaterialId);
  }

  const sdb = getSqliteDb();
  const row = sdb.prepare(`
    SELECT COALESCE(SUM(quantity_change), 0) AS stock
    FROM raw_material_movements
    WHERE raw_material_id = ?
  `).get(rawMaterialId);
  return Number(row ? row.stock : 0);
}

async function getFinishedGoodStock(finishedProductId) {
  const store = asyncLocalStorage.getStore();

  if (isPostgresConfigured) {
    const pg = getPostgresModule();
    const client = (store && store.pgClient) ? store.pgClient : null;
    return pg.getFinishedGoodStock(finishedProductId, client);
  }

  if (isOracleConfigured) {
    const ora = getOracleModule();
    if (store && store.conn) {
      return ora.connGetFinishedGoodStock(store.conn, finishedProductId);
    }
    return ora.getFinishedGoodStock(finishedProductId);
  }

  const sdb = getSqliteDb();
  const row = sdb.prepare(`
    SELECT COALESCE(SUM(quantity_change), 0) AS stock
    FROM finished_goods_movements
    WHERE finished_product_id = ?
  `).get(finishedProductId);
  return Number(row ? row.stock : 0);
}

// =============================================================================
// AUTH HELPERS
// =============================================================================
async function getUserByToken(token) {
  if (!token) return null;
  return executeGet('SELECT * FROM users WHERE session_token = ?', [token]);
}

async function getManagerByToken(token) {
  if (!token) return null;
  return executeGet('SELECT * FROM managers WHERE manager_token = ?', [token]);
}

// =============================================================================
// COMPANY SETTINGS & CACHE
// =============================================================================
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

async function refreshCompanySettings() {
  try {
    const rows = await executeAll('SELECT key, value FROM settings', []);
    const s = {};
    if (rows && Array.isArray(rows)) {
      for (const r of rows) {
        const k = (r.key || r.KEY || '').toLowerCase();
        s[k] = r.value || r.VALUE;
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

// =============================================================================
// COMPACT DB OBJECT
// =============================================================================
const db = {
  prepare,
  all: async (sql, ...args) => executeAll(sql, normalizeArgs(args)),
  get: async (sql, ...args) => executeGet(sql, normalizeArgs(args)),
  run: async (sql, ...args) => executeRun(sql, normalizeArgs(args)),
  exec: async (sql) => {
    if (isPostgresConfigured) {
      const pg = getPostgresModule();
      return pg.getPool().query(sql);
    } else if (isOracleConfigured) {
      const ora = getOracleModule();
      return ora.executeQuery(sql, {}, { autoCommit: true });
    } else {
      return getSqliteDb().exec(sql);
    }
  },
  init,
  close,
  isPostgres: isPostgresConfigured,
  isOracle: isOracleConfigured
};

module.exports = {
  db,
  init,
  close,
  runTransaction,
  getNextCode,
  getRawMaterialStock,
  getFinishedGoodStock,
  getUserByToken,
  getManagerByToken,
  getCompanySettings,
  refreshCompanySettings,
  executeAll,
  executeGet,
  executeRun,
  isPostgresConfigured,
  isOracleConfigured
};
