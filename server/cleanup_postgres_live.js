/**
 * TRIPAL ERP — Cleanup Test Data for Layerbase PostgreSQL & Live Ready
 */
const dbFacade = require('./db/index');

async function cleanLiveData() {
  console.log('=== TRIPAL ERP: CLEANING POSTGRESQL LAYERBASE PRODUCTION DB ===\n');
  await dbFacade.init();
  const db = dbFacade.db;

  try {
    // 1. Clear test sales and items
    console.log('Clearing sales items & sales...');
    await db.prepare('DELETE FROM sales_items').run();
    await db.prepare('DELETE FROM sales').run();

    // 2. Clear payments / receipts
    console.log('Clearing payments & receipts...');
    await db.prepare('DELETE FROM payments').run();

    // 3. Clear purchases & items
    console.log('Clearing purchase items & purchases...');
    await db.prepare('DELETE FROM purchase_items').run();
    await db.prepare('DELETE FROM raw_material_purchases').run();

    // 4. Clear production & consumption
    console.log('Clearing production outputs, wastage, batches...');
    await db.prepare('DELETE FROM production_outputs').run();
    await db.prepare('DELETE FROM wastage_records').run();
    await db.prepare('DELETE FROM production_batches').run();
    await db.prepare('DELETE FROM consumption_batch_items').run();
    await db.prepare('DELETE FROM consumption_batches').run();
    await db.prepare('DELETE FROM production_orders').run();

    // 5. Clear stock movements
    console.log('Clearing RM & FG stock movements...');
    await db.prepare('DELETE FROM raw_material_movements').run();
    await db.prepare('DELETE FROM finished_goods_movements').run();

    // 6. Clear test opening balances, bank transfers, debit/credit notes, bank accounts
    console.log('Clearing test opening balances, bank transfers, debit/credit notes, bank accounts...');
    await db.prepare('DELETE FROM debit_credit_notes').run();
    await db.prepare('DELETE FROM bank_transfers').run();
    await db.prepare('DELETE FROM opening_balances').run();
    await db.prepare('DELETE FROM bank_accounts').run();

    // 7. Remove test Financial Years (keep only FY 2026-27 as active)
    console.log('Configuring Financial Years (keeping only FY 2026-27 Active)...');
    await db.prepare("DELETE FROM financial_years WHERE name != 'FY 2026-27'").run();
    await db.prepare("UPDATE financial_years SET is_active = true WHERE name = 'FY 2026-27'").run();

    // 8. Clear audit logs for tests
    console.log('Cleaning audit logs...');
    await db.prepare("DELETE FROM audit_logs WHERE action IN ('CREATE_TEST', 'TEST') OR entity_type = 'DEBIT_CREDIT_NOTE' OR entity_type = 'BANK_ACCOUNT' OR entity_type = 'BANK_TRANSFER'").run();

    console.log('\n✅ Successfully cleaned all demo data from PostgreSQL Layerbase!');

    // Verify final state
    console.log('\n=== FINAL PRODUCTION DATABASE STATE ===');
    const fys = await db.prepare('SELECT id, name, is_active FROM financial_years').all();
    console.log('Active Financial Years:', fys);

    const tables = [
      'financial_years', 'sales', 'raw_material_purchases', 'payments',
      'production_batches', 'consumption_batches', 'raw_material_movements',
      'finished_goods_movements', 'opening_balances', 'bank_accounts',
      'debit_credit_notes', 'bank_transfers', 'customers', 'suppliers',
      'raw_materials', 'finished_products', 'managers', 'users'
    ];

    for (const t of tables) {
      const countRow = await db.prepare('SELECT COUNT(*) as c FROM ' + t).get();
      console.log(`${t.padEnd(26)}: ${countRow.c}`);
    }

    console.log('\n=== MASTERS PRESERVED ===');
    const custs = await db.prepare('SELECT id, customer_code, name FROM customers').all();
    console.log('Customers:', custs);
    const supps = await db.prepare('SELECT id, supplier_code, name FROM suppliers').all();
    console.log('Suppliers:', supps);
    const rms = await db.prepare('SELECT id, code, name FROM raw_materials').all();
    console.log('Raw Materials:', rms);
    const fgs = await db.prepare('SELECT id, product_code, product_name FROM finished_products').all();
    console.log('Finished Goods:', fgs);
    const mgrs = await db.prepare('SELECT id, name, status FROM managers').all();
    console.log('Managers:', mgrs);
    const usrs = await db.prepare('SELECT id, username, role, name FROM users').all();
    console.log('Users:', usrs);

  } catch (err) {
    console.error('❌ Error cleaning database:', err);
  } finally {
    await dbFacade.close();
    process.exit(0);
  }
}

cleanLiveData();
