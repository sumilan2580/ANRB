const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./tripal_erp.sqlite');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('All tables:');
tables.forEach(t => {
  const cnt = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
  console.log('  ' + t.name + ': ' + cnt.c);
});
db.close();
