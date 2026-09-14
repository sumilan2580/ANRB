// One-time migration script: fix production_outputs FK that points to deleted backup table
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('tripal_erp.sqlite');

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('PRAGMA journal_mode = WAL;');

// Check current FK state
const masterRow = db.prepare(
  "SELECT sql FROM sqlite_master WHERE name = 'production_outputs'"
).get();
console.log('Current production_outputs CREATE SQL:');
console.log(masterRow ? masterRow.sql : 'NOT FOUND');

if (masterRow && masterRow.sql && masterRow.sql.includes('_production_batches_old')) {
  console.log('\nMigrating production_outputs to fix broken FK...');
  db.exec(`
    ALTER TABLE production_outputs RENAME TO _production_outputs_old;

    CREATE TABLE production_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      finished_product_id INTEGER NOT NULL,
      gsm INTEGER,
      width_size TEXT,
      length_val TEXT,
      colour TEXT,
      grade TEXT,
      quantity_kg REAL NOT NULL,
      unit TEXT DEFAULT 'KG',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (finished_product_id) REFERENCES finished_products(id)
    );

    INSERT INTO production_outputs
      SELECT id, batch_id, finished_product_id, gsm, width_size, length_val, colour, grade, quantity_kg, unit, created_at
      FROM _production_outputs_old;

    DROP TABLE _production_outputs_old;
  `);
  console.log('production_outputs FK fixed successfully!');
} else {
  console.log('production_outputs FK is already correct, no fix needed.');
}

db.exec('PRAGMA foreign_keys = ON;');
console.log('Done.');
