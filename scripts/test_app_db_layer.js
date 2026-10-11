'use strict';

const { db, init: initDb, close: closeDb, getCompanySettings } = require('../server/db/index');

async function test() {
  console.log('Testing app DB layer initialization against Neon...');
  await initDb();

  console.log('\nTesting queryAll on masters...');
  const rms = await db.prepare('SELECT count(*) as c FROM raw_materials').get();
  console.log(`  Raw materials count: ${rms.c}`);

  const fgs = await db.prepare('SELECT count(*) as c FROM finished_products').get();
  console.log(`  Finished goods count: ${fgs.c}`);

  const users = await db.prepare('SELECT id, username, role FROM users').all();
  console.log(`  Users:`, users);

  const settings = getCompanySettings();
  console.log(`  Company name: ${settings.company_name}`);

  await closeDb();
  console.log('App DB layer verified successfully!');
}

test().catch(err => {
  console.error('App DB test failed:', err);
  process.exit(1);
});
