'use strict';

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function calculateTotals(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();

  try {
    // 1. Raw materials & finished goods stocks
    const rmStockRes = await client.query('SELECT COALESCE(SUM(quantity_change), 0) AS total_rm_stock FROM raw_material_movements');
    const fgStockRes = await client.query('SELECT COALESCE(SUM(quantity_change), 0) AS total_fg_stock FROM finished_goods_movements');

    // 2. Purchases
    const purchRes = await client.query(`
      SELECT 
        COUNT(*) AS total_count,
        COALESCE(SUM(quantity_kg), 0) AS total_qty_kg,
        COALESCE(SUM(taxable_amount), 0) AS total_taxable,
        COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total_gst,
        COALESCE(SUM(total_amount), 0) AS total_amount
      FROM raw_material_purchases
      WHERE is_voided = 0;
    `);

    // Purchase items quantity
    const purchItemsRes = await client.query('SELECT COUNT(*) AS total_items, COALESCE(SUM(quantity), 0) AS total_quantity FROM purchase_items');

    // 3. Sales
    const salesRes = await client.query(`
      SELECT 
        COUNT(*) AS total_count,
        COALESCE(SUM(quantity_kg), 0) AS total_qty_kg,
        COALESCE(SUM(taxable_amount), 0) AS total_taxable,
        COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total_gst,
        COALESCE(SUM(total_amount), 0) AS total_amount
      FROM sales
      WHERE is_voided = 0;
    `);

    // Sales items quantity
    const salesItemsRes = await client.query('SELECT COUNT(*) AS total_items, COALESCE(SUM(quantity), 0) AS total_quantity FROM sales_items');

    // 4. Payments & Receipts
    const custReceiptsRes = await client.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE party_type = 'CUSTOMER' AND is_voided = 0;
    `);

    const suppPaymentsRes = await client.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE party_type = 'SUPPLIER' AND is_voided = 0;
    `);

    const expensePaymentsRes = await client.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE party_type = 'EXPENSE' AND is_voided = 0;
    `);

    const incomePaymentsRes = await client.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE party_type = 'INCOME' AND is_voided = 0;
    `);

    // 5. Opening Balances
    const opBalRes = await client.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount, COALESCE(SUM(quantity), 0) AS total_qty
      FROM opening_balances;
    `);

    // 6. Attendance
    const staffAttRes = await client.query('SELECT COUNT(*) AS count FROM staff_attendance');

    // 7. Audit logs
    const auditRes = await client.query('SELECT COUNT(*) AS count FROM audit_logs');

    // 8. Auth users & managers
    const usersRes = await client.query('SELECT COUNT(*) AS count FROM users');
    const managersRes = await client.query('SELECT COUNT(*) AS count FROM managers');

    // 9. Staff & Masters
    const staffRes = await client.query('SELECT COUNT(*) AS count FROM staff');
    const custCountRes = await client.query('SELECT COUNT(*) AS count FROM customers');
    const suppCountRes = await client.query('SELECT COUNT(*) AS count FROM suppliers');
    const rmCountRes = await client.query('SELECT COUNT(*) AS count FROM raw_materials');
    const fgCountRes = await client.query('SELECT COUNT(*) AS count FROM finished_products');

    return {
      rm_stock_kg: Number(rmStockRes.rows[0].total_rm_stock),
      fg_stock_kg: Number(fgStockRes.rows[0].total_fg_stock),
      purchases: {
        active_bills: parseInt(purchRes.rows[0].total_count, 10),
        quantity_kg: Number(purchRes.rows[0].total_qty_kg),
        taxable_amount: Number(purchRes.rows[0].total_taxable),
        gst_amount: Number(purchRes.rows[0].total_gst),
        total_amount: Number(purchRes.rows[0].total_amount),
        purchase_items_count: parseInt(purchItemsRes.rows[0].total_items, 10),
        purchase_items_qty: Number(purchItemsRes.rows[0].total_quantity)
      },
      sales: {
        active_invoices: parseInt(salesRes.rows[0].total_count, 10),
        quantity_kg: Number(salesRes.rows[0].total_qty_kg),
        taxable_amount: Number(salesRes.rows[0].total_taxable),
        gst_amount: Number(salesRes.rows[0].total_gst),
        total_amount: Number(salesRes.rows[0].total_amount),
        sales_items_count: parseInt(salesItemsRes.rows[0].total_items, 10),
        sales_items_qty: Number(salesItemsRes.rows[0].total_quantity)
      },
      payments: {
        customer_receipts_count: parseInt(custReceiptsRes.rows[0].count, 10),
        customer_receipts_total: Number(custReceiptsRes.rows[0].total),
        supplier_payments_count: parseInt(suppPaymentsRes.rows[0].count, 10),
        supplier_payments_total: Number(suppPaymentsRes.rows[0].total),
        expense_payments_count: parseInt(expensePaymentsRes.rows[0].count, 10),
        expense_payments_total: Number(expensePaymentsRes.rows[0].total),
        income_payments_count: parseInt(incomePaymentsRes.rows[0].count, 10),
        income_payments_total: Number(incomePaymentsRes.rows[0].total)
      },
      opening_balances: {
        count: parseInt(opBalRes.rows[0].count, 10),
        total_amount: Number(opBalRes.rows[0].total_amount),
        total_qty: Number(opBalRes.rows[0].total_qty)
      },
      masters: {
        customers: parseInt(custCountRes.rows[0].count, 10),
        suppliers: parseInt(suppCountRes.rows[0].count, 10),
        raw_materials: parseInt(rmCountRes.rows[0].count, 10),
        finished_products: parseInt(fgCountRes.rows[0].count, 10),
        staff: parseInt(staffRes.rows[0].count, 10)
      },
      attendance_count: parseInt(staffAttRes.rows[0].count, 10),
      audit_logs_count: parseInt(auditRes.rows[0].count, 10),
      users_count: parseInt(usersRes.rows[0].count, 10),
      managers_count: parseInt(managersRes.rows[0].count, 10)
    };
  } finally {
    client.release();
    await pool.end();
  }
}

async function run() {
  const totals = await calculateTotals(process.env.DATABASE_URL);
  console.log('===============================================================');
  console.log('LAYERBASE SOURCE BUSINESS TOTALS:');
  console.log('===============================================================');
  console.log(JSON.stringify(totals, null, 2));

  fs.writeFileSync(
    path.resolve(__dirname, '../backups/anrb_layerbase_production_backup/business_totals.json'),
    JSON.stringify(totals, null, 2),
    'utf8'
  );
  console.log('Saved to backups/anrb_layerbase_production_backup/business_totals.json');
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { calculateTotals };
