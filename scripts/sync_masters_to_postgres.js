/**
 * Sync genuine masters from SQLite to Layerbase PostgreSQL
 */
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function syncMasters() {
  console.log('=== SYNCING GENUINE MASTERS FROM SQLITE TO LAYERBASE POSTGRESQL ===\n');

  const sqlite = new DatabaseSync('tripal_erp.sqlite');
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1
  });

  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    // 1. Raw Materials
    const rms = sqlite.prepare('SELECT * FROM raw_materials').all();
    console.log(`Syncing ${rms.length} raw materials...`);
    for (const rm of rms) {
      await client.query(`
        INSERT INTO raw_materials (id, code, name, category, unit, min_stock_alert, status, hsn_code, gst_percent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          unit = EXCLUDED.unit,
          min_stock_alert = EXCLUDED.min_stock_alert,
          status = EXCLUDED.status,
          hsn_code = EXCLUDED.hsn_code,
          gst_percent = EXCLUDED.gst_percent
      `, [rm.id, rm.code, rm.name, rm.category, rm.unit, rm.min_stock_alert, rm.status, rm.hsn_code, rm.gst_percent]);
    }
    await client.query("SELECT setval('raw_materials_id_seq', (SELECT COALESCE(MAX(id), 1) FROM raw_materials), true)");

    // 2. Finished Products
    const fgs = sqlite.prepare('SELECT * FROM finished_products').all();
    console.log(`Syncing ${fgs.length} finished products...`);
    for (const fg of fgs) {
      await client.query(`
        INSERT INTO finished_products (id, product_code, product_name, gsm, width_size, length_val, colour, grade, unit, min_stock_alert, status, hsn_code, gst_percent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          product_code = EXCLUDED.product_code,
          product_name = EXCLUDED.product_name,
          gsm = EXCLUDED.gsm,
          width_size = EXCLUDED.width_size,
          length_val = EXCLUDED.length_val,
          colour = EXCLUDED.colour,
          grade = EXCLUDED.grade,
          unit = EXCLUDED.unit,
          min_stock_alert = EXCLUDED.min_stock_alert,
          status = EXCLUDED.status,
          hsn_code = EXCLUDED.hsn_code,
          gst_percent = EXCLUDED.gst_percent
      `, [fg.id, fg.product_code, fg.product_name, fg.gsm, fg.width_size, fg.length_val, fg.colour, fg.grade, fg.unit, fg.min_stock_alert, fg.status, fg.hsn_code, fg.gst_percent]);
    }
    await client.query("SELECT setval('finished_products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM finished_products), true)");

    // 3. Customers
    const custs = sqlite.prepare('SELECT * FROM customers').all();
    console.log(`Syncing ${custs.length} customers...`);
    for (const c of custs) {
      await client.query(`
        INSERT INTO customers (id, customer_code, name, phone, email, address, billing_address, shipping_address, city, state, pincode, state_code, gst_number, customer_type, opening_balance, opening_balance_type, remarks, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          customer_code = EXCLUDED.customer_code,
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          billing_address = EXCLUDED.billing_address,
          shipping_address = EXCLUDED.shipping_address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          pincode = EXCLUDED.pincode,
          state_code = EXCLUDED.state_code,
          gst_number = EXCLUDED.gst_number,
          customer_type = EXCLUDED.customer_type,
          opening_balance = EXCLUDED.opening_balance,
          opening_balance_type = EXCLUDED.opening_balance_type,
          remarks = EXCLUDED.remarks,
          status = EXCLUDED.status
      `, [c.id, c.customer_code, c.name, c.phone, c.email, c.address, c.billing_address, c.shipping_address, c.city, c.state, c.pincode, c.state_code, c.gst_number, c.customer_type, c.opening_balance || 0, c.opening_balance_type || 'Debit', c.remarks, c.status || 'active']);
    }
    await client.query("SELECT setval('customers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM customers), true)");

    // 4. Suppliers
    const supps = sqlite.prepare('SELECT * FROM suppliers').all();
    console.log(`Syncing ${supps.length} suppliers...`);
    for (const s of supps) {
      await client.query(`
        INSERT INTO suppliers (id, supplier_code, name, phone, email, address, city, state, pincode, state_code, gst_number, supplier_type, opening_balance, opening_balance_type, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          supplier_code = EXCLUDED.supplier_code,
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          pincode = EXCLUDED.pincode,
          state_code = EXCLUDED.state_code,
          gst_number = EXCLUDED.gst_number,
          supplier_type = EXCLUDED.supplier_type,
          opening_balance = EXCLUDED.opening_balance,
          opening_balance_type = EXCLUDED.opening_balance_type,
          status = EXCLUDED.status
      `, [s.id, s.supplier_code, s.name, s.phone, s.email, s.address, s.city, s.state, s.pincode, s.state_code, s.gst_number, s.supplier_type, s.opening_balance || 0, s.opening_balance_type || 'Credit', s.status || 'active']);
    }
    await client.query("SELECT setval('suppliers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM suppliers), true)");

    // 5. Machines
    const machines = sqlite.prepare('SELECT * FROM machines').all();
    console.log(`Syncing ${machines.length} machines...`);
    for (const m of machines) {
      await client.query(`
        INSERT INTO machines (id, machine_code, name, capacity_kg_per_day, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          machine_code = EXCLUDED.machine_code,
          name = EXCLUDED.name,
          capacity_kg_per_day = EXCLUDED.capacity_kg_per_day,
          status = EXCLUDED.status
      `, [m.id, m.machine_code, m.name, m.capacity_kg_hr || m.capacity_kg_per_day || 5000, m.status]);
    }
    if (machines.length > 0) {
      await client.query("SELECT setval('machines_id_seq', (SELECT COALESCE(MAX(id), 1) FROM machines), true)");
    }

    // 6. Shifts
    const shifts = sqlite.prepare('SELECT * FROM shifts').all();
    console.log(`Syncing ${shifts.length} shifts...`);
    for (const sh of shifts) {
      await client.query(`
        INSERT INTO shifts (id, name, start_time, end_time, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          status = EXCLUDED.status
      `, [sh.id, sh.name, sh.start_time, sh.end_time, sh.status]);
    }
    if (shifts.length > 0) {
      await client.query("SELECT setval('shifts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM shifts), true)");
    }

    // 7. Financial Years
    await client.query(`
      INSERT INTO financial_years (name, start_date, end_date, is_active)
      VALUES ('FY 2026-27', '2026-04-01', '2027-03-31', true)
      ON CONFLICT (name) DO UPDATE SET is_active = true
    `);

    await client.query('COMMIT');
    console.log('\n✅ Successfully synced all genuine masters to Layerbase PostgreSQL!');

    // Verify
    const rmRes = await client.query('SELECT count(*) FROM raw_materials');
    const fgRes = await client.query('SELECT count(*) FROM finished_products');
    const custRes = await client.query('SELECT count(*) FROM customers');
    const suppRes = await client.query('SELECT count(*) FROM suppliers');
    const machRes = await client.query('SELECT count(*) FROM machines');
    const shRes = await client.query('SELECT count(*) FROM shifts');
    const fyRes = await client.query('SELECT name, is_active FROM financial_years');

    console.log('\n--- VERIFICATION IN POSTGRESQL ---');
    console.log('Raw Materials:   ', rmRes.rows[0].count);
    console.log('Finished Products:', fgRes.rows[0].count);
    console.log('Customers:       ', custRes.rows[0].count);
    console.log('Suppliers:       ', suppRes.rows[0].count);
    console.log('Machines:        ', machRes.rows[0].count);
    console.log('Shifts:          ', shRes.rows[0].count);
    console.log('Financial Years: ', fyRes.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Sync failed:', err);
  } finally {
    client.release();
    await pgPool.end();
  }
}

syncMasters();
