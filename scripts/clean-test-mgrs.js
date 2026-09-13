const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('tripal_erp.sqlite');
db.exec("DELETE FROM managers WHERE name IN ('test', 'SmokeTestMgr2')");
console.log('Cleaned test managers');
