'use strict';
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

function hashPassword(p) {
  return crypto.createHash('sha256').update(String(p).trim()).digest('hex');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  // Get stored password
  const r = await pool.query("SELECT id, username, password, status FROM users WHERE LOWER(username)='admin'");
  const row = r.rows[0];
  console.log('Admin row found:', !!row);
  if (!row) { await pool.end(); return; }
  console.log('Stored password (first 20 chars):', row.password ? row.password.substring(0, 20) + '...' : 'NULL');
  console.log('Password length:', row.password ? row.password.length : 0);
  console.log('Status:', row.status);

  // What we compute for 'anrb1'
  const computed = hashPassword('anrb1');
  console.log('\nComputed hash for "anrb1":', computed);
  console.log('Stored password           :', row.password);
  console.log('\nMatch (hash)?  ', computed === row.password);
  console.log('Match (plain)? ', 'anrb1' === row.password);

  await pool.end();
})().catch(e => console.error(e));
