'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database.');
    console.log('Running ALTER TABLE for users and managers...');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT;');
    await client.query('ALTER TABLE managers ADD COLUMN IF NOT EXISTS permissions TEXT;');
    
    const defPerms = JSON.stringify([
      'orders', 'purchases', 'consumptions', 'productions', 'sales',
      'payments', 'attendance', 'ledger', 'outstanding', 'masters'
    ]);
    
    const uRes = await client.query(
      "UPDATE users SET permissions = $1 WHERE permissions IS NULL OR permissions = ''",
      [defPerms]
    );
    console.log('Updated users with default permissions:', uRes.rowCount);
    
    const mRes = await client.query(
      "UPDATE managers SET permissions = $1 WHERE permissions IS NULL OR permissions = ''",
      [defPerms]
    );
    console.log('Updated managers with default permissions:', mRes.rowCount);

    const checkUsers = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'permissions'"
    );
    console.log('users.permissions column check:', checkUsers.rows);

    const checkManagers = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'managers' AND column_name = 'permissions'"
    );
    console.log('managers.permissions column check:', checkManagers.rows);

    const usersList = await client.query('SELECT id, username, role, permissions FROM users');
    console.log('Current users:', usersList.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => {
  console.log('Migration completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Error running migration:', err);
  process.exit(1);
});
