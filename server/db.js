const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '..', 'tripal_erp.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for performance and data integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'admin',
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      device_id TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      manager_token TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS raw_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      unit TEXT DEFAULT 'KG',
      min_stock_alert REAL DEFAULT 1000,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      gst_number TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      capacity_kg_per_day REAL DEFAULT 5000,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      gst_number TEXT,
      status TEXT DEFAULT 'active',
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finished_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE NOT NULL,
      product_name TEXT DEFAULT 'Tripal',
      gsm INTEGER NOT NULL,
      width_size TEXT NOT NULL,
      length_val TEXT,
      colour TEXT NOT NULL,
      grade TEXT DEFAULT 'Grade A',
      unit TEXT DEFAULT 'KG',
      min_stock_alert REAL DEFAULT 500,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS raw_material_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_code TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      supplier_id INTEGER NOT NULL,
      raw_material_id INTEGER NOT NULL,
      quantity_kg REAL NOT NULL,
      rate_per_kg REAL NOT NULL,
      total_amount REAL NOT NULL,
      invoice_number TEXT,
      remarks TEXT,
      manager_id INTEGER,
      manager_name TEXT NOT NULL,
      device_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
    );

    CREATE TABLE IF NOT EXISTS raw_material_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      raw_material_id INTEGER NOT NULL,
      quantity_change REAL NOT NULL,
      balance_after REAL NOT NULL,
      manager_name TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
    );

    CREATE TABLE IF NOT EXISTS production_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_code TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      machine_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      raw_material_id INTEGER NOT NULL,
      raw_material_used_kg REAL NOT NULL,
      total_finished_kg REAL NOT NULL,
      total_wastage_kg REAL NOT NULL,
      wastage_reason TEXT,
      remarks TEXT,
      manager_id INTEGER,
      manager_name TEXT NOT NULL,
      device_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machines(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
    );

    CREATE TABLE IF NOT EXISTS production_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      finished_product_id INTEGER NOT NULL,
      gsm INTEGER,
      width_size TEXT,
      length_val TEXT,
      colour TEXT,
      grade TEXT,
      quantity_kg REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (finished_product_id) REFERENCES finished_products(id)
    );

    CREATE TABLE IF NOT EXISTS finished_goods_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      finished_product_id INTEGER NOT NULL,
      quantity_change REAL NOT NULL,
      balance_after REAL NOT NULL,
      manager_name TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (finished_product_id) REFERENCES finished_products(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_code TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      finished_product_id INTEGER NOT NULL,
      quantity_kg REAL NOT NULL,
      rate_per_kg REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_type TEXT DEFAULT 'Cash',
      remarks TEXT,
      manager_id INTEGER,
      manager_name TEXT NOT NULL,
      device_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (finished_product_id) REFERENCES finished_products(id)
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adjustment_code TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      system_quantity_kg REAL NOT NULL,
      physical_quantity_kg REAL NOT NULL,
      difference_kg REAL NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      adjusted_by TEXT NOT NULL,
      device_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      original_values TEXT,
      new_values TEXT,
      performed_by TEXT,
      device_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_code TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      party_type TEXT NOT NULL, -- 'CUSTOMER' (receipt) or 'SUPPLIER' (payment)
      party_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'Bank', -- 'Cash', 'Bank', 'Cheque', 'RTGS/NEFT', 'UPI'
      reference_no TEXT,
      remarks TEXT,
      created_by TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS production_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      order_date TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      customer_order_no TEXT,
      finished_product_id INTEGER NOT NULL,
      gsm INTEGER,
      size TEXT,
      required_quantity REAL NOT NULL,
      unit TEXT DEFAULT 'KG',
      delivery_date TEXT,
      remarks TEXT,
      status TEXT DEFAULT 'Pending', -- 'Pending', 'In Production', 'Completed', 'Cancelled'
      created_by TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (finished_product_id) REFERENCES finished_products(id)
    );

    CREATE TABLE IF NOT EXISTS consumption_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      production_order_id INTEGER,
      machine_id INTEGER,
      shift_id INTEGER,
      manager_id INTEGER,
      manager_name TEXT NOT NULL,
      device_id TEXT,
      status TEXT DEFAULT 'Issued', -- 'Draft', 'Issued', 'Cancelled'
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
      FOREIGN KEY (machine_id) REFERENCES machines(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS consumption_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumption_batch_id INTEGER NOT NULL,
      raw_material_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'KG',
      batch_lot TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (consumption_batch_id) REFERENCES consumption_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      raw_material_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'KG',
      rate REAL NOT NULL,
      discount REAL DEFAULT 0,
      hsn_code TEXT,
      gst_percent REAL DEFAULT 0,
      taxable_amount REAL NOT NULL,
      gst_amount REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES raw_material_purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
    );

    CREATE TABLE IF NOT EXISTS sales_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      finished_product_id INTEGER NOT NULL,
      gsm INTEGER,
      size TEXT,
      hsn_code TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'KG',
      rate REAL NOT NULL,
      discount REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      taxable_amount REAL NOT NULL,
      gst_amount REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (finished_product_id) REFERENCES finished_products(id)
    );

    CREATE TABLE IF NOT EXISTS wastage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      production_id INTEGER,
      production_no TEXT NOT NULL,
      production_order_id INTEGER,
      product_id INTEGER,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'KG',
      reason TEXT,
      manager_name TEXT,
      machine_id INTEGER,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ─── Runtime migration: relax NOT NULL on production_batches ────────────────
  // SQLite does not support ALTER COLUMN, so we rename → recreate → copy.
  try {
    const cols = db.prepare('PRAGMA table_info(production_batches)').all();
    const rmIdCol = cols.find(c => c.name === 'raw_material_id');
    // If raw_material_id is still NOT NULL (notnull = 1) we need to migrate
    if (rmIdCol && rmIdCol.notnull === 1) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`ALTER TABLE production_batches RENAME TO _production_batches_old;`);
      db.exec(`
        CREATE TABLE production_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_code TEXT UNIQUE NOT NULL,
          date TEXT NOT NULL,
          machine_id INTEGER,
          shift_id INTEGER,
          raw_material_id INTEGER,
          raw_material_used_kg REAL DEFAULT 0,
          total_finished_kg REAL NOT NULL DEFAULT 0,
          total_wastage_kg REAL NOT NULL DEFAULT 0,
          wastage_reason TEXT,
          wastage_unit TEXT DEFAULT 'KG',
          remarks TEXT,
          manager_id INTEGER,
          manager_name TEXT NOT NULL DEFAULT 'Admin',
          device_id TEXT,
          production_order_id INTEGER,
          consumption_batch_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      db.exec(`
        INSERT INTO production_batches (
          id, batch_code, date, machine_id, shift_id, raw_material_id,
          raw_material_used_kg, total_finished_kg, total_wastage_kg,
          wastage_reason, remarks, manager_id, manager_name, device_id,
          created_at, updated_at
        )
        SELECT
          id, batch_code, date, machine_id, shift_id, raw_material_id,
          raw_material_used_kg, total_finished_kg, total_wastage_kg,
          wastage_reason, remarks, manager_id, manager_name, device_id,
          created_at, updated_at
        FROM _production_batches_old;
      `);
      // Also recreate production_outputs to fix its FK before dropping the old table
      db.exec(`ALTER TABLE production_outputs RENAME TO _production_outputs_old;`);
      db.exec(`
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
      `);
      db.exec(`
        INSERT INTO production_outputs
          SELECT id, batch_id, finished_product_id, gsm, width_size, length_val,
                 colour, grade, quantity_kg, unit, created_at
          FROM _production_outputs_old;
        DROP TABLE _production_outputs_old;
        DROP TABLE _production_batches_old;
      `);
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('[DB] Migrated production_batches & production_outputs: relaxed NOT NULL constraints.');
    }
  } catch (migErr) {
    console.warn('[DB] production_batches migration skipped (may already be up to date):', migErr.message);
  }

  // ─── Fix broken production_outputs FK (if it points to the old backup table) ─
  try {
    const poRow = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'production_outputs'").get();
    if (poRow && poRow.sql && poRow.sql.includes('_production_batches_old')) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`ALTER TABLE production_outputs RENAME TO _production_outputs_old;`);
      db.exec(`
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
      `);
      db.exec(`
        INSERT INTO production_outputs
          SELECT id, batch_id, finished_product_id, gsm, width_size, length_val,
                 colour, grade, quantity_kg, unit, created_at
          FROM _production_outputs_old;
        DROP TABLE _production_outputs_old;
      `);
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('[DB] Fixed production_outputs FK reference.');
    }
  } catch (fixErr) {
    console.warn('[DB] production_outputs FK fix skipped:', fixErr.message);
  }
}


function getNextCode(prefix, table, column) {
  const rows = db.prepare(`SELECT ${column} FROM ${table} WHERE ${column} LIKE '${prefix}-%'`).all();
  let maxNum = 0;
  for (const row of rows) {
    if (!row || !row[column]) continue;
    const parts = String(row[column]).split('-');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  let nextNum = maxNum + 1;
  while (true) {
    const candidate = `${prefix}-${String(nextNum).padStart(6, '0')}`;
    const exists = db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`).get(candidate);
    if (!exists) {
      return candidate;
    }
    nextNum++;
  }
}

function getRawMaterialStock(rawMaterialId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(quantity_change), 0) AS stock
    FROM raw_material_movements
    WHERE raw_material_id = ?
  `).get(rawMaterialId);
  return Number(row ? row.stock : 0);
}

function getFinishedGoodStock(finishedProductId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(quantity_change), 0) AS stock
    FROM finished_goods_movements
    WHERE finished_product_id = ?
  `).get(finishedProductId);
  return Number(row ? row.stock : 0);
}

function seedDefaultData() {
  const rmCount = db.prepare('SELECT COUNT(*) as count FROM raw_materials').get().count;
  if (rmCount > 0) return;

  // 1. Raw Materials
  const insertRM = db.prepare(`
    INSERT INTO raw_materials (code, name, category, unit, min_stock_alert, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertRM.run('RM-001', 'LDPE (Low Density Polyethylene)', 'Polymer', 'KG', 2000, 'active');
  insertRM.run('RM-002', 'HDPE (High Density Polyethylene)', 'Polymer', 'KG', 2000, 'active');
  insertRM.run('RM-003', 'LLDPE (Linear Low Density)', 'Polymer', 'KG', 1500, 'active');
  insertRM.run('RM-004', 'Masterbatch - Blue 201', 'Masterbatch', 'KG', 500, 'active');
  insertRM.run('RM-005', 'Masterbatch - Black UV', 'Masterbatch', 'KG', 500, 'active');
  insertRM.run('RM-006', 'Masterbatch - Yellow 102', 'Masterbatch', 'KG', 300, 'active');
  insertRM.run('RM-007', 'UV Stabilizer Additive', 'Additive', 'KG', 200, 'active');
  insertRM.run('RM-008', 'Calcium Carbonate Filler', 'Additive', 'KG', 1000, 'active');

  // 2. Suppliers
  const insertSupp = db.prepare(`
    INSERT INTO suppliers (name, phone, address, gst_number, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertSupp.run('Reliance Polymers Ltd', '+91 98200 12345', 'Hazira Manufacturing Div, Surat, Gujarat', '24AAACR1234F1Z0', 'active');
  insertSupp.run('Indian Oil Petrochemicals', '+91 98250 67890', 'Panipat Refinery Complex, Haryana', '06AAACI9876C1ZX', 'active');
  insertSupp.run('Supreme Masterbatch Pvt Ltd', '+91 98980 11223', 'GIDC Silvassa, Dadra & Nagar Haveli', '26AABCS4321A1ZB', 'active');
  insertSupp.run('Gujarat Polymers & Additives', '+91 97234 55667', 'Makarpura GIDC, Vadodara', '24AABCG5544H1Z1', 'active');

  // 3. Machines
  const insertMach = db.prepare(`
    INSERT INTO machines (machine_code, name, capacity_kg_per_day, status)
    VALUES (?, ?, ?, ?)
  `);
  insertMach.run('EXT-01', 'Extruder Plant Line 1 (Heavy Gauge)', 10000, 'active');
  insertMach.run('EXT-02', 'Extruder Plant Line 2 (Multi-Layer)', 8000, 'active');
  insertMach.run('LAM-01', 'Lamination & Film Coating Machine', 6000, 'active');
  insertMach.run('CUT-01', 'Automatic Sealing & Eyelet Unit', 5000, 'active');

  // 4. Shifts
  const insertShift = db.prepare(`
    INSERT INTO shifts (name, start_time, end_time, status)
    VALUES (?, ?, ?, ?)
  `);
  insertShift.run('Morning Shift', '08:00 AM', '04:00 PM', 'active');
  insertShift.run('Evening Shift', '04:00 PM', '12:00 AM', 'active');
  insertShift.run('Night Shift', '12:00 AM', '08:00 AM', 'active');

  // 5. Customers
  const insertCust = db.prepare(`
    INSERT INTO customers (name, phone, address, gst_number, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertCust.run('Kisan Agri Tarpaulins & Nets', '+91 94220 33445', 'APMC Yard, Nashik, Maharashtra', '27AAACK1122P1Z4', 'active', 'Regular buyer for agricultural sheets');
  insertCust.run('National Hardware & Sheet Mart', '+91 98111 22334', 'Chawri Bazar, Delhi', '07AACCN3344D1Z2', 'active', 'Wholesale construction sheets');
  insertCust.run('Metro Infrastructure Supplies', '+91 99000 88776', 'Peenya Industrial Area, Bengaluru', '29AAACM5566K1Z9', 'active', 'Heavy duty blue waterproof covers');
  insertCust.run('Apex Plastic & Tarpaulin Traders', '+91 98300 44556', 'Burrabazar, Kolkata', '19AACCA7788M1Z3', 'active', 'Grade A multi-size distributor');
  insertCust.run('Shivam Agro Agencies', '+91 98765 43210', 'Grain Market, Indore, MP', '23AABCS9988F1Z7', 'active', 'Farm shade and grain tripal');

  // 6. Finished Goods
  const insertFG = db.prepare(`
    INSERT INTO finished_products (product_code, product_name, gsm, width_size, length_val, colour, grade, unit, min_stock_alert, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertFG.run('FG-001', 'Tripal Plastic Sheet', 120, '12 FT', '100 M', 'Blue', 'Grade A', 'KG', 500, 'active');
  insertFG.run('FG-002', 'Tripal Plastic Sheet', 150, '16 FT', '100 M', 'Blue', 'Grade A', 'KG', 500, 'active');
  insertFG.run('FG-003', 'Tripal Plastic Sheet', 150, '16 FT', '100 M', 'Yellow', 'Grade A', 'KG', 400, 'active');
  insertFG.run('FG-004', 'Tripal Heavy Duty', 200, '20 FT', '50 M', 'Green', 'Grade A', 'KG', 500, 'active');
  insertFG.run('FG-005', 'Tripal Premium Black UV', 250, '24 FT', '50 M', 'Black', 'Heavy Duty', 'KG', 300, 'active');
  insertFG.run('FG-006', 'Tripal Light Cover', 100, '10 FT', '100 M', 'Silver', 'Standard', 'KG', 300, 'active');

  // 7. Managers
  const insertMgr = db.prepare(`
    INSERT INTO managers (name, device_id, phone, status, manager_token)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertMgr.run('Rahul', 'dev-rahul-01', '+91 98201 10001', 'active', 'mgr_rahul_token_2026');
  insertMgr.run('Amit', 'dev-amit-02', '+91 98201 10002', 'active', 'mgr_amit_token_2026');
  insertMgr.run('Sanjay', 'dev-sanjay-03', '+91 98201 10003', 'active', 'mgr_sanjay_token_2026');

  // 8. Seed Initial Purchases to establish initial stock
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Purchase 1: 15,000 KG LDPE by Rahul
  const pur1Code = 'PUR-000001';
  db.prepare(`
    INSERT INTO raw_material_purchases (purchase_code, date, supplier_id, raw_material_id, quantity_kg, rate_per_kg, total_amount, invoice_number, remarks, manager_id, manager_name, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pur1Code, yesterday, 1, 1, 15000, 95.50, 15000 * 95.50, 'INV-REL-8821', 'Bulk prime LDPE bags', 1, 'Rahul', 'dev-rahul-01');

  db.prepare(`
    INSERT INTO raw_material_movements (movement_type, reference_type, reference_id, raw_material_id, quantity_change, balance_after, manager_name, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('PURCHASE', 'PURCHASE', pur1Code, 1, 15000, 15000, 'Rahul', 'Initial stock purchase');

  // Purchase 2: 10,000 KG HDPE by Amit
  const pur2Code = 'PUR-000002';
  db.prepare(`
    INSERT INTO raw_material_purchases (purchase_code, date, supplier_id, raw_material_id, quantity_kg, rate_per_kg, total_amount, invoice_number, remarks, manager_id, manager_name, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pur2Code, yesterday, 2, 2, 10000, 98.00, 10000 * 98.00, 'INV-IOC-4412', 'HDPE injection grade granules', 2, 'Amit', 'dev-amit-02');

  db.prepare(`
    INSERT INTO raw_material_movements (movement_type, reference_type, reference_id, raw_material_id, quantity_change, balance_after, manager_name, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('PURCHASE', 'PURCHASE', pur2Code, 2, 10000, 10000, 'Amit', 'Initial stock purchase');

  // Purchase 3: 2,000 KG Masterbatch Blue by Sanjay
  const pur3Code = 'PUR-000003';
  db.prepare(`
    INSERT INTO raw_material_purchases (purchase_code, date, supplier_id, raw_material_id, quantity_kg, rate_per_kg, total_amount, invoice_number, remarks, manager_id, manager_name, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pur3Code, today, 3, 4, 2000, 160.00, 2000 * 160.00, 'INV-SUP-901', 'High dispersion blue colorant', 3, 'Sanjay', 'dev-sanjay-03');

  db.prepare(`
    INSERT INTO raw_material_movements (movement_type, reference_type, reference_id, raw_material_id, quantity_change, balance_after, manager_name, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('PURCHASE', 'PURCHASE', pur3Code, 4, 2000, 2000, 'Sanjay', 'Initial stock purchase');

  // 9. Seed Production Batch:
  // 4,000 KG LDPE used by Rahul on EXT-01:
  // Output 1: FG-001 (120 GSM 12 FT Blue) -> 1,800 KG
  // Output 2: FG-002 (150 GSM 16 FT Blue) -> 2,000 KG
  // Wastage: 200 KG (Machine Waste)
  // Total = 1800 + 2000 + 200 = 4000 KG
  const prod1Code = 'PROD-000001';
  const prodBatchRes = db.prepare(`
    INSERT INTO production_batches (batch_code, date, machine_id, shift_id, raw_material_id, raw_material_used_kg, total_finished_kg, total_wastage_kg, wastage_reason, remarks, manager_id, manager_name, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(prod1Code, today, 1, 1, 1, 4000, 3800, 200, 'Machine Waste', 'Smooth continuous extrusion run', 1, 'Rahul', 'dev-rahul-01');
  const batchId = prodBatchRes.lastInsertRowid;

  // Deduct RM stock
  const newRMBalance = 15000 - 4000;
  db.prepare(`
    INSERT INTO raw_material_movements (movement_type, reference_type, reference_id, raw_material_id, quantity_change, balance_after, manager_name, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('PRODUCTION_CONSUMPTION', 'PRODUCTION', prod1Code, 1, -4000, newRMBalance, 'Rahul', 'Extruder Plant Line 1 consumption');

  // Insert Output 1
  db.prepare(`
    INSERT INTO production_outputs (batch_id, finished_product_id, gsm, width_size, length_val, colour, grade, quantity_kg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, 1, 120, '12 FT', '100 M', 'Blue', 'Grade A', 1800);
  db.prepare(`
    INSERT INTO finished_goods_movements (movement_type, reference_type, reference_id, finished_product_id, quantity_change, balance_after, manager_name, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('PRODUCTION', 'PRODUCTION', prod1Code, 1, 1800, 1800, 'Rahul', 'Batch output 1');

  // Insert Output 2
  db.prepare(`
    INSERT INTO production_outputs (batch_id, finished_product_id, gsm, width_size, length_val, colour, grade, quantity_kg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, 2, 150, '16 FT', '100 M', 'Blue', 'Grade A', 2000);
  db.prepare(`
    INSERT INTO finished_goods_movements (movement_type, reference_type, reference_id, finished_product_id, quantity_change, balance_after, manager_name, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('PRODUCTION', 'PRODUCTION', prod1Code, 2, 2000, 2000, 'Rahul', 'Batch output 2');

  // 10. Seed Sale:
  // 500 KG FG-002 (150 GSM 16 FT Blue) to Kisan Agri Tarpaulins @ ₹145/KG = ₹72,500 by Amit
  const sale1Code = 'SALE-000001';
  db.prepare(`
    INSERT INTO sales (sale_code, date, customer_id, finished_product_id, quantity_kg, rate_per_kg, total_amount, payment_type, remarks, manager_id, manager_name, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sale1Code, today, 1, 2, 500, 145.00, 72500, 'Credit', 'Dispatched for agricultural greenhouse covers', 2, 'Amit', 'dev-amit-02');

  db.prepare(`
    INSERT INTO finished_goods_movements (movement_type, reference_type, reference_id, finished_product_id, quantity_change, balance_after, manager_name, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('SALE', 'SALE', sale1Code, 2, -500, 1500, 'Amit', 'Customer dispatch SALE-000001');

  console.log('Seeding completed successfully!');
}

initSchema();

// Auto-migrate schema: ensure manager_token column exists in managers table
try {
  const managerCols = db.prepare('PRAGMA table_info(managers);').all();
  const hasManagerToken = managerCols.some(col => col.name === 'manager_token');
  if (!hasManagerToken) {
    db.exec('ALTER TABLE managers ADD COLUMN manager_token TEXT;');
  }
  // Ensure existing managers have tokens
  const existingManagers = db.prepare('SELECT id, name, manager_token FROM managers').all();
  for (const m of existingManagers) {
    if (!m.manager_token) {
      const token = 'mgr_' + m.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 10);
      db.prepare('UPDATE managers SET manager_token = ? WHERE id = ?').run(token, m.id);
    }
  }
  // Ensure default admin user exists
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'admin'").get().count;
  if (adminCount === 0) {
    db.prepare(`
      INSERT INTO users (username, password, role, name)
      VALUES (?, ?, 'admin', ?)
    `).run('admin', 'admin123', 'Master Admin');
  }

  // ── Web session token column on users (for manager/admin web login) ──────────
  try {
    db.exec('ALTER TABLE users ADD COLUMN session_token TEXT;');
  } catch { /* already exists */ }
  try {
    db.exec('ALTER TABLE users ADD COLUMN manager_id INTEGER;');
  } catch { /* already exists */ }
  try {
    db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT \'active\';');
  } catch { /* already exists */ }

  // Idempotent column migrations for GST, HSN, State, Invoice fields, Multi-items and Ledgers
  const safeMigrations = [
    `ALTER TABLE raw_materials ADD COLUMN hsn_code TEXT DEFAULT '3901';`,
    `ALTER TABLE raw_materials ADD COLUMN gst_percent REAL DEFAULT 18;`,
    `ALTER TABLE raw_materials ADD COLUMN unit TEXT DEFAULT 'KG';`,
    `ALTER TABLE finished_products ADD COLUMN hsn_code TEXT DEFAULT '3926';`,
    `ALTER TABLE finished_products ADD COLUMN gst_percent REAL DEFAULT 18;`,
    `ALTER TABLE finished_products ADD COLUMN unit TEXT DEFAULT 'KG';`,
    `ALTER TABLE customers ADD COLUMN state TEXT DEFAULT 'Gujarat';`,
    `ALTER TABLE customers ADD COLUMN city TEXT DEFAULT 'Ahmedabad';`,
    `ALTER TABLE customers ADD COLUMN pincode TEXT DEFAULT '382445';`,
    `ALTER TABLE customers ADD COLUMN state_code TEXT DEFAULT '24';`,
    `ALTER TABLE customers ADD COLUMN customer_code TEXT;`,
    `ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'GST Registered';`,
    `ALTER TABLE customers ADD COLUMN billing_address TEXT;`,
    `ALTER TABLE customers ADD COLUMN shipping_address TEXT;`,
    `ALTER TABLE customers ADD COLUMN email TEXT;`,
    `ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0;`,
    `ALTER TABLE customers ADD COLUMN opening_balance_type TEXT DEFAULT 'Debit';`,
    `ALTER TABLE suppliers ADD COLUMN state TEXT DEFAULT 'Gujarat';`,
    `ALTER TABLE suppliers ADD COLUMN city TEXT DEFAULT 'Ahmedabad';`,
    `ALTER TABLE suppliers ADD COLUMN pincode TEXT DEFAULT '382445';`,
    `ALTER TABLE suppliers ADD COLUMN state_code TEXT DEFAULT '24';`,
    `ALTER TABLE suppliers ADD COLUMN supplier_code TEXT;`,
    `ALTER TABLE suppliers ADD COLUMN supplier_type TEXT DEFAULT 'GST Registered';`,
    `ALTER TABLE suppliers ADD COLUMN email TEXT;`,
    `ALTER TABLE suppliers ADD COLUMN opening_balance REAL DEFAULT 0;`,
    `ALTER TABLE suppliers ADD COLUMN opening_balance_type TEXT DEFAULT 'Credit';`,
    `ALTER TABLE raw_material_purchases ADD COLUMN taxable_amount REAL DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN gst_percent REAL DEFAULT 18;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN cgst_amount REAL DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN sgst_amount REAL DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN igst_amount REAL DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN purchase_type TEXT DEFAULT 'GST';`,
    `ALTER TABLE raw_material_purchases ADD COLUMN discount_amount REAL DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN other_charges REAL DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN round_off REAL DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN payment_mode TEXT DEFAULT 'Credit';`,
    `ALTER TABLE raw_material_purchases ADD COLUMN is_voided INTEGER DEFAULT 0;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN voided_at DATETIME;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN voided_by TEXT;`,
    `ALTER TABLE raw_material_purchases ADD COLUMN void_reason TEXT;`,
    `ALTER TABLE raw_material_movements ADD COLUMN unit TEXT DEFAULT 'KG';`,
    `ALTER TABLE production_batches ADD COLUMN production_order_id INTEGER;`,
    `ALTER TABLE production_batches ADD COLUMN consumption_batch_id INTEGER;`,
    `ALTER TABLE production_batches ADD COLUMN wastage_unit TEXT DEFAULT 'KG';`,
    `ALTER TABLE production_batches ADD COLUMN is_voided INTEGER DEFAULT 0;`,
    `ALTER TABLE production_batches ADD COLUMN voided_at DATETIME;`,
    `ALTER TABLE production_batches ADD COLUMN voided_by TEXT;`,
    `ALTER TABLE production_batches ADD COLUMN void_reason TEXT;`,
    `ALTER TABLE production_outputs ADD COLUMN unit TEXT DEFAULT 'KG';`,
    `ALTER TABLE finished_goods_movements ADD COLUMN unit TEXT DEFAULT 'KG';`,
    `ALTER TABLE sales ADD COLUMN invoice_number TEXT;`,
    `ALTER TABLE sales ADD COLUMN taxable_amount REAL DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN gst_percent REAL DEFAULT 18;`,
    `ALTER TABLE sales ADD COLUMN cgst_amount REAL DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN sgst_amount REAL DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN igst_amount REAL DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN sales_type TEXT DEFAULT 'GST';`,
    `ALTER TABLE sales ADD COLUMN customer_gstin TEXT;`,
    `ALTER TABLE sales ADD COLUMN billing_address TEXT;`,
    `ALTER TABLE sales ADD COLUMN shipping_address TEXT;`,
    `ALTER TABLE sales ADD COLUMN discount_amount REAL DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN other_charges REAL DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN round_off REAL DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN is_voided INTEGER DEFAULT 0;`,
    `ALTER TABLE sales ADD COLUMN voided_at DATETIME;`,
    `ALTER TABLE sales ADD COLUMN voided_by TEXT;`,
    `ALTER TABLE sales ADD COLUMN void_reason TEXT;`,
    `ALTER TABLE payments ADD COLUMN against_type TEXT DEFAULT 'ON_ACCOUNT';`,
    `ALTER TABLE payments ADD COLUMN invoice_id INTEGER;`,
    `ALTER TABLE payments ADD COLUMN manager_id INTEGER;`,
    `ALTER TABLE payments ADD COLUMN manager_name TEXT;`,
    `ALTER TABLE payments ADD COLUMN device_id TEXT;`,
    `ALTER TABLE payments ADD COLUMN is_voided INTEGER DEFAULT 0;`,
    `ALTER TABLE payments ADD COLUMN voided_at DATETIME;`,
    `ALTER TABLE payments ADD COLUMN voided_by TEXT;`,
    `ALTER TABLE payments ADD COLUMN void_reason TEXT;`,
  ];

  for (const sql of safeMigrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already added, safe to ignore
    }
  }

  // Seed default company profile settings
  const defaultCompanySettings = [
    ['company_name', 'TRIPAL MANUFACTURING PVT. LTD.'],
    ['company_address', 'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445'],
    ['company_gstin', '24AAACT1234F1Z5'],
    ['company_state', 'Gujarat'],
    ['company_state_code', '24'],
    ['company_phone', '+91 79 2583 0000'],
    ['company_email', 'accounts@tripalmanufacturing.com'],
    ['bank_name', 'State Bank of India'],
    ['bank_account_no', '382910482910'],
    ['bank_ifsc', 'SBIN0001234'],
    ['bank_branch', 'Vatva Industrial Estate Branch']
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, val] of defaultCompanySettings) {
    insertSetting.run(key, val);
  }

  // Backfill codes for suppliers without supplier_code
  const suppsWithoutCode = db.prepare("SELECT id FROM suppliers WHERE supplier_code IS NULL OR supplier_code = ''").all();
  for (const s of suppsWithoutCode) {
    db.prepare("UPDATE suppliers SET supplier_code = ? WHERE id = ?").run(`SUP-${String(s.id).padStart(5, '0')}`, s.id);
  }

  // Backfill codes for customers without customer_code
  const custsWithoutCode = db.prepare("SELECT id FROM customers WHERE customer_code IS NULL OR customer_code = ''").all();
  for (const c of custsWithoutCode) {
    db.prepare("UPDATE customers SET customer_code = ? WHERE id = ?").run(`CUST-${String(c.id).padStart(5, '0')}`, c.id);
  }

  // Backfill existing purchases without GST fields
  db.exec(`
    UPDATE raw_material_purchases
    SET taxable_amount = ROUND(total_amount / 1.18, 2),
        gst_percent = 18,
        cgst_amount = ROUND((total_amount - (total_amount / 1.18)) / 2, 2),
        sgst_amount = ROUND((total_amount - (total_amount / 1.18)) / 2, 2),
        igst_amount = 0
    WHERE taxable_amount IS NULL OR taxable_amount = 0;
  `);

  // Backfill existing sales without invoice number or GST fields
  db.exec(`
    UPDATE sales
    SET invoice_number = COALESCE(invoice_number, REPLACE(sale_code, 'SALE-', 'INV-2026-')),
        taxable_amount = ROUND(total_amount / 1.18, 2),
        gst_percent = 18,
        cgst_amount = ROUND((total_amount - (total_amount / 1.18)) / 2, 2),
        sgst_amount = ROUND((total_amount - (total_amount / 1.18)) / 2, 2),
        igst_amount = 0
    WHERE taxable_amount IS NULL OR taxable_amount = 0;
  `);

  // Safely resolve any duplicate invoice numbers before applying unique index
  try {
    const dupSales = db.prepare(`
      SELECT s.id, s.invoice_number 
      FROM sales s 
      WHERE s.is_voided = 0 AND s.invoice_number IN (
        SELECT invoice_number FROM sales WHERE is_voided = 0 AND invoice_number IS NOT NULL GROUP BY invoice_number HAVING COUNT(*) > 1
      ) ORDER BY s.id ASC
    `).all();
    const seenInvoices = new Set();
    for (const s of dupSales) {
      if (seenInvoices.has(s.invoice_number)) {
        const uniqueInv = `INV-2026-${String(s.id).padStart(6, '0')}`;
        db.prepare("UPDATE sales SET invoice_number = ? WHERE id = ?").run(uniqueInv, s.id);
      } else {
        seenInvoices.add(s.invoice_number);
      }
    }
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_invoice_unique ON sales(invoice_number) WHERE is_voided = 0 AND invoice_number IS NOT NULL;`);
  } catch (idxErr) {
    console.warn('[DB] idx_sales_invoice_unique notice:', idxErr.message);
  }

  // Backfill existing single-item purchases into purchase_items
  db.exec(`
    INSERT INTO purchase_items (
      purchase_id, raw_material_id, quantity, unit, rate, discount, hsn_code, gst_percent,
      taxable_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, total_amount
    )
    SELECT p.id, p.raw_material_id, p.quantity_kg, 'KG', p.rate_per_kg, 0,
           COALESCE(rm.hsn_code, '3901'), COALESCE(p.gst_percent, 18),
           COALESCE(p.taxable_amount, p.total_amount),
           COALESCE(p.cgst_amount + p.sgst_amount + p.igst_amount, 0),
           COALESCE(p.cgst_amount, 0), COALESCE(p.sgst_amount, 0), COALESCE(p.igst_amount, 0),
           p.total_amount
    FROM raw_material_purchases p
    LEFT JOIN raw_materials rm ON p.raw_material_id = rm.id
    WHERE (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) = 0;
  `);

  // Backfill existing single-item sales into sales_items
  db.exec(`
    INSERT INTO sales_items (
      sale_id, finished_product_id, gsm, size, hsn_code, quantity, unit, rate, discount,
      gst_percent, taxable_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, total_amount
    )
    SELECT s.id, s.finished_product_id, fp.gsm, fp.width_size, COALESCE(fp.hsn_code, '3926'),
           s.quantity_kg, 'KG', s.rate_per_kg, 0, COALESCE(s.gst_percent, 18),
           COALESCE(s.taxable_amount, s.total_amount),
           COALESCE(s.cgst_amount + s.sgst_amount + s.igst_amount, 0),
           COALESCE(s.cgst_amount, 0), COALESCE(s.sgst_amount, 0), COALESCE(s.igst_amount, 0),
           s.total_amount
    FROM sales s
    LEFT JOIN finished_products fp ON s.finished_product_id = fp.id
    WHERE (SELECT COUNT(*) FROM sales_items WHERE sale_id = s.id) = 0;
  `);

  // Backfill wastage_records from production_batches if total_wastage_kg > 0
  db.exec(`
    INSERT INTO wastage_records (
      date, production_id, production_no, production_order_id, quantity, unit, reason, manager_name, machine_id
    )
    SELECT pb.date, pb.id, pb.batch_code, pb.production_order_id, pb.total_wastage_kg,
           COALESCE(pb.wastage_unit, 'KG'), pb.wastage_reason, pb.manager_name, pb.machine_id
    FROM production_batches pb
    WHERE pb.total_wastage_kg > 0
      AND (SELECT COUNT(*) FROM wastage_records WHERE production_id = pb.id) = 0;
  `);

  // Ensure standard Tripal raw materials with correct units (KG / PCS)
  const stdRMs = [
    { name: 'Tripal Roll', code: 'RM-TR01', category: 'Fabric/Film', unit: 'KG', min_stock: 1000, hsn: '3926', gst: 18 },
    { name: 'Plastic Rope', code: 'RM-PR01', category: 'Rope', unit: 'KG', min_stock: 500, hsn: '5607', gst: 18 },
    { name: 'Eyelet', code: 'RM-EY01', category: 'Hardware', unit: 'PCS', min_stock: 2000, hsn: '8308', gst: 18 },
    { name: 'Washer', code: 'RM-WA01', category: 'Hardware', unit: 'PCS', min_stock: 2000, hsn: '7318', gst: 18 },
    { name: 'Liner', code: 'RM-LN01', category: 'Film', unit: 'KG', min_stock: 500, hsn: '3920', gst: 18 },
    { name: 'Patti', code: 'RM-PT01', category: 'Strip', unit: 'KG', min_stock: 500, hsn: '3926', gst: 18 },
  ];
  for (const rm of stdRMs) {
    const existing = db.prepare('SELECT id, unit FROM raw_materials WHERE LOWER(name) = LOWER(?)').get(rm.name);
    if (!existing) {
      db.prepare(`
        INSERT INTO raw_materials (code, name, category, unit, min_stock_alert, status, hsn_code, gst_percent)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(rm.code, rm.name, rm.category, rm.unit, rm.min_stock, rm.hsn, rm.gst);
    } else if (existing.unit !== rm.unit) {
      db.prepare('UPDATE raw_materials SET unit = ?, hsn_code = ? WHERE id = ?').run(rm.unit, rm.hsn, existing.id);
    }
  }

} catch (migErr) {
  console.error('Migration notice:', migErr.message);
}

seedDefaultData();

function getManagerByToken(token) {
  if (!token) return null;
  return db.prepare('SELECT * FROM managers WHERE manager_token = ?').get(token);
}

// Look up a web-session user by the bearer token stored in users.session_token
function getUserByToken(token) {
  if (!token) return null;
  return db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
}

function getCompanySettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return {
    company_name: settings.company_name || 'TRIPAL MANUFACTURING PVT. LTD.',
    companyName: settings.company_name || 'TRIPAL MANUFACTURING PVT. LTD.',
    company_address: settings.company_address || 'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445',
    address: settings.company_address || 'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445',
    company_gstin: settings.company_gstin || '24AAACT1234F1Z5',
    gstNumber: settings.company_gstin || '24AAACT1234F1Z5',
    company_state: settings.company_state || 'Gujarat',
    state: settings.company_state || 'Gujarat',
    company_state_code: settings.company_state_code || '24',
    stateCode: settings.company_state_code || '24',
    company_phone: settings.company_phone || '+91 79 2583 0000',
    phone: settings.company_phone || '+91 79 2583 0000',
    company_email: settings.company_email || 'accounts@tripalmanufacturing.com',
    email: settings.company_email || 'accounts@tripalmanufacturing.com',
    city: settings.company_city || 'Ahmedabad',
    pincode: settings.company_pincode || '382445',
    bank_name: settings.bank_name || 'State Bank of India',
    bankName: settings.bank_name || 'State Bank of India',
    bank_account_no: settings.bank_account_no || '382910482910',
    bankAccountNo: settings.bank_account_no || '382910482910',
    bank_ifsc: settings.bank_ifsc || 'SBIN0001234',
    bankIfsc: settings.bank_ifsc || 'SBIN0001234',
    bank_branch: settings.bank_branch || 'Vatva Industrial Estate Branch',
    bankBranch: settings.bank_branch || 'Vatva Industrial Estate Branch'
  };
}

module.exports = {
  db,
  getNextCode,
  getRawMaterialStock,
  getFinishedGoodStock,
  getManagerByToken,
  getUserByToken,
  getCompanySettings
};
