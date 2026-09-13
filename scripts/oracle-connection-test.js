'use strict';

/**
 * TRIPAL ERP — Oracle Autonomous Database Connection Test
 *
 * Tests ONLY:
 *   1. Oracle network reachability (TNS / TCP)
 *   2. Authentication (username + password + wallet)
 *   3. Basic DML access (SELECT from DUAL)
 *   4. Schema access (USER_TABLES visibility)
 *
 * DOES NOT read, write, or modify any data.
 *
 * Usage:
 *   node scripts/oracle-connection-test.js
 */

const path = require('path');
const oracledb = require('oracledb');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const PASS = 'PASS';
const FAIL = 'FAIL';

async function runConnectionTest() {
  console.log('');
  console.log('===================================================================');
  console.log('  TRIPAL ERP -- ORACLE AUTONOMOUS DATABASE: CONNECTION TEST');
  console.log('===================================================================');
  console.log('');

  const user            = process.env.ORACLE_USER;
  const password        = process.env.ORACLE_PASSWORD;
  const connectString   = process.env.ORACLE_CONNECT_STRING;
  const walletLocation  = process.env.ORACLE_WALLET_LOCATION;
  const walletPassword  = process.env.ORACLE_WALLET_PASSWORD;

  // ── Pre-flight env check ─────────────────────────────────────────────────
  console.log('[ Pre-flight ] Checking environment variables...');

  const missingVars = [];
  if (!user)          missingVars.push('ORACLE_USER');
  if (!password)      missingVars.push('ORACLE_PASSWORD');
  if (!connectString) missingVars.push('ORACLE_CONNECT_STRING');

  if (missingVars.length > 0) {
    console.log('');
    console.log('[FAIL] Missing required .env variables:');
    missingVars.forEach(v => console.log('     - ' + v));
    console.log('');
    console.log('ACTION REQUIRED:');
    console.log('  1. Copy  .env.example  -->  .env  (in repo root: c:\\ANRB\\.env)');
    console.log('  2. Fill in the following values in .env:');
    console.log('       ORACLE_USER            -- your Oracle DB username (e.g. ADMIN)');
    console.log('       ORACLE_PASSWORD         -- your Oracle DB password');
    console.log('       ORACLE_CONNECT_STRING   -- TNS alias from tnsnames.ora');
    console.log('                                (e.g.  tripalerp_high)');
    console.log('       ORACLE_WALLET_LOCATION  -- absolute path to wallet folder');
    console.log('                                (e.g.  C:/ANRB/wallet)');
    console.log('       ORACLE_WALLET_PASSWORD  -- wallet password you set when downloading');
    console.log('');
    console.log('  3. Re-run:  node scripts/oracle-connection-test.js');
    console.log('');
    printOracleGuide();
    process.exit(1);
  }

  console.log('  ORACLE_USER:             ' + user);
  console.log('  ORACLE_CONNECT_STRING:   ' + connectString);
  console.log('  ORACLE_WALLET_LOCATION:  ' + (walletLocation || '(not set -- wallet-less TCP mode)'));
  console.log('  ORACLE_PASSWORD:         <hidden>');
  console.log('  ORACLE_WALLET_PASSWORD:  <hidden>');
  console.log('');

  // ── Test 1: Oracle Client init ────────────────────────────────────────────
  let test1 = PASS + ' (thin mode)';
  try {
    oracledb.initOracleClient();
    test1 = PASS + ' (thick mode - Oracle Client found)';
  } catch (e) {
    if (e.message && e.message.includes('already been initialized')) {
      test1 = PASS;
    }
    // else thin mode is fine for Autonomous DB
  }

  // ── Build connection config ───────────────────────────────────────────────
  const config = { user, password, connectString };
  if (walletLocation) {
    config.walletLocation = walletLocation;
    if (walletPassword) config.walletPassword = walletPassword;
  }

  // ── Test 2: Oracle Connection ─────────────────────────────────────────────
  let test2 = FAIL;
  let test3 = FAIL;
  let test4 = FAIL;
  let conn = null;
  let oracleVersion = null;
  let tableCount = null;
  let errorDetail = null;
  let dbTime = null;

  try {
    conn = await oracledb.getConnection(config);
    test2 = PASS;
  } catch (e) {
    errorDetail = e.message;
  }

  if (conn) {
    // ── Test 3: Basic DB query (SELECT 1 FROM DUAL) ───────────────────────
    try {
      const r = await conn.execute("SELECT 'OK' AS ping, SYSDATE AS db_time FROM DUAL");
      if (r.rows && r.rows.length > 0) {
        test3 = PASS;
        dbTime = r.rows[0][1];
      }
    } catch (e) {
      errorDetail = e.message;
    }

    // ── Test 4: Schema access (USER_TABLES) ───────────────────────────────
    try {
      const vr = await conn.execute(
        "SELECT banner FROM v$version WHERE ROWNUM = 1"
      ).catch(() => null);
      if (vr && vr.rows && vr.rows[0]) {
        oracleVersion = vr.rows[0][0];
      }

      const tr = await conn.execute(
        "SELECT COUNT(*) AS cnt FROM user_tables",
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      tableCount = Number(tr.rows[0].CNT);
      test4 = PASS;
    } catch (e) {
      errorDetail = e.message;
    }

    await conn.close();
  }

  // ── Print Results ─────────────────────────────────────────────────────────
  console.log('-------------------------------------------------------------------');
  console.log('  ORACLE CONNECTION TEST RESULTS');
  console.log('-------------------------------------------------------------------');
  console.log('');
  console.log('  ORACLE CLIENT:        ' + test1);
  console.log('  ORACLE CONNECTION:    ' + test2);
  console.log('  DATABASE:             ' + test3);
  console.log('  SCHEMA ACCESS:        ' + test4);
  console.log('');

  if (dbTime)         console.log('  Oracle server time:   ' + dbTime);
  if (oracleVersion)  console.log('  Oracle version:       ' + oracleVersion);

  if (tableCount !== null) {
    console.log('  Tables in schema:     ' + tableCount);
    if (tableCount === 0) {
      console.log('');
      console.log('  [NOTICE] No tables found -- schema not yet created.');
      console.log('  Run schema creation before migrating data.');
    } else if (tableCount < 24) {
      console.log('  [WARNING] Only ' + tableCount + '/24 expected tables found.');
    } else {
      console.log('  [OK] All 24+ ERP tables present in Oracle schema.');
    }
  }

  console.log('');

  const allPass = test2 === PASS && test3 === PASS && test4 === PASS;

  if (allPass) {
    console.log('===================================================================');
    console.log('  ALL TESTS PASSED -- Oracle is reachable and authenticated.');
    console.log('');
    if (tableCount === 0) {
      console.log('  NEXT STEP -- Schema has not been created yet.');
      console.log('  Run the schema creation script first:');
      console.log('    node scripts/oracle-schema-create.js');
    } else if (tableCount < 24) {
      console.log('  NEXT STEP -- Schema is incomplete. Re-run schema creation:');
      console.log('    node scripts/oracle-schema-create.js');
    } else {
      console.log('  NEXT STEP -- To migrate SQLite data to Oracle:');
      console.log('    npm run migrate:dry     (dry run - safe, no changes)');
      console.log('    npm run migrate         (actual migration)');
    }
    console.log('===================================================================');
  } else {
    console.log('===================================================================');
    console.log('  CONNECTION FAILED');
    if (errorDetail) {
      console.log('');
      console.log('  Error detail:');
      errorDetail.split('\n').forEach(line => console.log('    ' + line));
    }
    console.log('');
    printTroubleshooting();
    console.log('===================================================================');
    process.exit(1);
  }
}

function printOracleGuide() {
  console.log('===================================================================');
  console.log('  HOW TO GET YOUR ORACLE AUTONOMOUS DATABASE CREDENTIALS');
  console.log('===================================================================');
  console.log('');
  console.log('  1. Log in to Oracle Cloud:  https://cloud.oracle.com');
  console.log('');
  console.log('  2. Go to: Oracle Database > Autonomous Databases');
  console.log('            > Click your Always Free ATP instance');
  console.log('');
  console.log('  3. Click "DB Connection" > "Download Wallet"');
  console.log('     Set a wallet password > Download ZIP');
  console.log('');
  console.log('  4. Extract the wallet ZIP to:   C:\\ANRB\\wallet\\');
  console.log('     The folder must contain:');
  console.log('       tnsnames.ora   sqlnet.ora');
  console.log('       cwallet.sso    ewallet.p12');
  console.log('');
  console.log('  5. Open  C:\\ANRB\\wallet\\tnsnames.ora');
  console.log('     Copy one service name, e.g.:  tripalerp_high');
  console.log('     Use that as ORACLE_CONNECT_STRING in your .env');
  console.log('');
  console.log('  6. Your .env (c:\\ANRB\\.env) should look like:');
  console.log('');
  console.log('       ORACLE_USER=ADMIN');
  console.log('       ORACLE_PASSWORD=YourStrongPassword123!');
  console.log('       ORACLE_CONNECT_STRING=tripalerp_high');
  console.log('       ORACLE_WALLET_LOCATION=C:/ANRB/wallet');
  console.log('       ORACLE_WALLET_PASSWORD=YourWalletPassword');
  console.log('       DB_ENGINE=oracle');
  console.log('');
  console.log('  SECURITY: .env is in .gitignore -- it will NEVER be committed.');
  console.log('  The wallet/ folder and *.sso / *.p12 files are also gitignored.');
  console.log('');
}

function printTroubleshooting() {
  console.log('  TROUBLESHOOTING GUIDE:');
  console.log('');
  console.log('  ORA-12170 / TNS:Could not resolve');
  console.log('    -> Wrong ORACLE_CONNECT_STRING.');
  console.log('       Check tnsnames.ora in your wallet folder for the exact');
  console.log('       service name (e.g. tripalerp_high, tripalerp_medium).');
  console.log('');
  console.log('  ORA-01017 (invalid username/password)');
  console.log('    -> Wrong ORACLE_USER or ORACLE_PASSWORD in .env.');
  console.log('       The ADMIN password is the one you set when creating the ATP.');
  console.log('');
  console.log('  NJS-516 / wallet error');
  console.log('    -> ORACLE_WALLET_LOCATION path is wrong, or the wallet folder');
  console.log('       is missing tnsnames.ora / cwallet.sso.');
  console.log('       Confirm you extracted ALL files from the wallet ZIP.');
  console.log('');
  console.log('  NJS-045 / thin mode connect string error');
  console.log('    -> Try the full Easy Connect format in ORACLE_CONNECT_STRING:');
  console.log('       (DESCRIPTION=(ADDRESS=...)...)  from tnsnames.ora');
  console.log('');
}

runConnectionTest().catch(err => {
  console.error('\n[FATAL] Unexpected error during connection test:');
  console.error('  ' + (err.message || err));
  process.exit(1);
});
