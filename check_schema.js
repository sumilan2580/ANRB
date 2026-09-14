const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./tripal_erp.sqlite');
const cols = db.prepare("PRAGMA table_info(raw_materials)").all();
const unitCol = cols.find(c => c.name === 'unit');
console.log('unit column:', unitCol ? JSON.stringify(unitCol) : 'NOT FOUND');
console.log('All columns:', cols.map(c => c.name).join(', '));
db.close();
