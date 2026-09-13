const fs = require('fs');
const path = require('path');

const srcPath = path.resolve(__dirname, '../server/index.sqlite.backup.js');
let code = fs.readFileSync(srcPath, 'utf8');

// 1. Replace imports at the top
code = code.replace(
  /const express = require\('express'\);\s*const cors = require\('cors'\);\s*const \{ db, getNextCode, getRawMaterialStock, getFinishedGoodStock, getManagerByToken, getUserByToken, getCompanySettings \} = require\('\.\/db'\);/,
  `const express = require('express');
const cors = require('cors');
const {
  db,
  init: initDb,
  close: closeDb,
  runTransaction,
  getNextCode,
  getRawMaterialStock,
  getFinishedGoodStock,
  getManagerByToken,
  getUserByToken,
  getCompanySettings,
  refreshCompanySettings
} = require('./db/index');`
);

// 2. Remove the old synchronous runTransaction definition (lines 11-22)
code = code.replace(
  /\/\/ Helper for atomic transaction execution\s*function runTransaction\(callback\) \{[\s\S]*?db\.exec\('ROLLBACK;'\);\s*throw err;\s*\}\s*\}/,
  `// (runTransaction is imported from ./db/index and is fully async)`
);

// 3. Make authenticateRole async
code = code.replace(
  /function authenticateRole\(req, res, next\) \{/,
  `async function authenticateRole(req, res, next) {`
);

// Update getUserByToken and getManagerByToken inside authenticateRole
code = code.replace(
  /const user = getUserByToken\(token\);/,
  `const user = await getUserByToken(token);`
);
code = code.replace(
  /const mgr = user\.manager_id\s*\?\s*db\.prepare\('SELECT \* FROM managers WHERE id = \?'\)\.get\(user\.manager_id\)\s*:\s*db\.prepare\('SELECT \* FROM managers WHERE LOWER\(name\) = LOWER\(\?\)'\)\.get\(user\.name\);/,
  `const mgr = user.manager_id
        ? await db.prepare('SELECT * FROM managers WHERE id = ?').get(user.manager_id)
        : await db.prepare('SELECT * FROM managers WHERE LOWER(name) = LOWER(?)').get(user.name);`
);
code = code.replace(
  /const manager = getManagerByToken\(managerToken\);/,
  `const manager = await getManagerByToken(managerToken);`
);

// 4. Make all route handlers async
// app.get/post/put/delete/patch(..., (req, res) => {
code = code.replace(
  /(app\.(?:get|post|put|delete|patch)\((?:\[[^\]]+\]|'[^']+')\s*,\s*(?:requireAdmin\s*,\s*)?)\((req,\s*res(?:,\s*next)?)\)\s*=>/g,
  `$1async ($2) =>`
);

// 5. Replace runTransaction(() => { with await runTransaction(async () => {
code = code.replace(
  /\brunTransaction\(\(\)\s*=>\s*\{/g,
  `await runTransaction(async () => {`
);

// 6. Handle specific map callbacks that contain database queries:
// 6-new1. batches.map in GET /api/transactions/consumption-batches
code = code.replace(
  /const result = batches\.map\(b => \(\{[\s\S]*?items: getItems\.all\(b\.id\)[\s\S]*?\}\)\);/,
  `const result = await Promise.all(batches.map(async b => ({
      ...b,
      production_status: (b.linked_production_id || b.status === 'Completed') ? 'Completed' : (b.status === 'Issued' ? 'Ready for Production' : b.status),
      items: await getItems.all(b.id)
    })));`
);

// 6-new2. rows.map in GET /api/transactions/purchases
code = code.replace(
  /const result = rows\.map\(r => \(\{[\s\S]*?items: getItems\.all\(r\.id\)[\s\S]*?\}\)\);/,
  `const result = await Promise.all(rows.map(async r => ({
      ...r,
      items: await getItems.all(r.id)
    })));`
);

// 6-new3. rows.map in GET /api/transactions/sales
code = code.replace(
  /const result = rows\.map\(r => \(\{[\s\S]*?items: getItems\.all\(r\.id\)[\s\S]*?\}\)\);/,
  `const result = await Promise.all(rows.map(async r => ({
      ...r,
      items: await getItems.all(r.id)
    })));`
);

// 6-new4. batches.map in GET /api/transactions/production
code = code.replace(
  /const result = batches\.map\(batch => \(\{[\s\S]*?consumed_materials: batch\.consumption_batch_id \? getConsumed\.all\(batch\.consumption_batch_id\) : \[\]\s*\}\)\);/,
  `const result = await Promise.all(batches.map(async batch => ({
      ...batch,
      outputs: await getOutputs.all(batch.id),
      consumed_materials: batch.consumption_batch_id ? await getConsumed.all(batch.consumption_batch_id) : []
    })));`
);

// 6a. rmTrend, prodTrend, salesTrend in /api/dashboard/stats
code = code.replace(
  /const rmTrend = last7Days\.map\(dateStr => \{[\s\S]*?return \{ date: dateStr\.slice\(5\), kg: Number\(row\.kg\), amount: Number\(row\.amount\) \};\s*\}\);/,
  `const rmTrend = await Promise.all(last7Days.map(async dateStr => {
      const row = (await db.prepare(\`
        SELECT COALESCE(SUM(quantity_kg), 0) as kg, COALESCE(SUM(total_amount), 0) as amount
        FROM raw_material_purchases
        WHERE date = ?
      \`).get(dateStr)) || { kg: 0, amount: 0 };
      return { date: dateStr.slice(5), kg: Number(row.kg), amount: Number(row.amount) };
    }));`
);

code = code.replace(
  /const prodTrend = last7Days\.map\(dateStr => \{[\s\S]*?wastageKg: Number\(row\.wastage_kg\)\s*\};\s*\}\);/,
  `const prodTrend = await Promise.all(last7Days.map(async dateStr => {
      const row = (await db.prepare(\`
        SELECT COALESCE(SUM(raw_material_used_kg), 0) as rm_used,
               COALESCE(SUM(total_finished_kg), 0) as finished_kg,
               COALESCE(SUM(total_wastage_kg), 0) as wastage_kg
        FROM production_batches
        WHERE date = ?
      \`).get(dateStr)) || { rm_used: 0, finished_kg: 0, wastage_kg: 0 };
      return {
        date: dateStr.slice(5),
        rmUsed: Number(row.rm_used),
        finishedKg: Number(row.finished_kg),
        wastageKg: Number(row.wastage_kg)
      };
    }));`
);

code = code.replace(
  /const salesTrend = last7Days\.map\(dateStr => \{[\s\S]*?return \{ date: dateStr\.slice\(5\), kg: Number\(row\.kg\), amount: Number\(row\.amount\) \};\s*\}\);/,
  `const salesTrend = await Promise.all(last7Days.map(async dateStr => {
      const row = (await db.prepare(\`
        SELECT COALESCE(SUM(quantity_kg), 0) as kg, COALESCE(SUM(total_amount), 0) as amount
        FROM sales
        WHERE date = ?
      \`).get(dateStr)) || { kg: 0, amount: 0 };
      return { date: dateStr.slice(5), kg: Number(row.kg), amount: Number(row.amount) };
    }));`
);

// 6b. enrichedPurchases, enrichedProductions, enrichedSales in /api/managers/my-entries
code = code.replace(
  /const enrichedPurchases = purchases\.map\(p => \(\{[\s\S]*?items: getPurItems\.all\(p\.id\)[\s\S]*?\}\)\);/,
  `const enrichedPurchases = await Promise.all(purchases.map(async p => ({
      ...p,
      items: await getPurItems.all(p.id)
    })));`
);

code = code.replace(
  /const enrichedProductions = productions\.map\(pb => \(\{[\s\S]*?outputs: getProdOutputs\.all\(pb\.id\)[\s\S]*?\}\)\);/,
  `const enrichedProductions = await Promise.all(productions.map(async pb => ({
      ...pb,
      outputs: await getProdOutputs.all(pb.id)
    })));`
);

code = code.replace(
  /const enrichedSales = sales\.map\(s => \(\{[\s\S]*?items: getSaleItems\.all\(s\.id\)[\s\S]*?\}\)\);/,
  `const enrichedSales = await Promise.all(sales.map(async s => ({
      ...s,
      items: await getSaleItems.all(s.id)
    })));`
);

// 6c. consumption batches report enriched:
code = code.replace(
  /const enriched = batches\.map\(b => \{[\s\S]*?yieldPct\s*\}\;\s*\}\);/,
  `const enriched = await Promise.all(batches.map(async b => {
      const items = await getItems.all(b.id);
      const totalIssuedQty = items.reduce((acc, it) => acc + (it.quantity || 0), 0);
      const linkedBatches = await db.prepare('SELECT * FROM production_batches WHERE consumption_batch_id = ? AND is_voided = 0').all(b.id);
      const totalProduced = linkedBatches.reduce((acc, pb) => acc + (pb.total_finished_kg || 0), 0);
      const totalWastage = linkedBatches.reduce((acc, pb) => acc + (pb.total_wastage_kg || 0), 0);
      const yieldPct = totalIssuedQty > 0 ? Number(((totalProduced / totalIssuedQty) * 100).toFixed(2)) : 0;
      return {
        ...b,
        items,
        totalIssuedQty: Number(totalIssuedQty.toFixed(2)),
        totalProduced: Number(totalProduced.toFixed(2)),
        totalWastage: Number(totalWastage.toFixed(2)),
        yieldPct
      };
    }));`
);

// 6d. Customer ledger salesRows with inner query:
code = code.replace(
  /const salesRows = db\.prepare\(salesQuery\)\.all\(\.\.\.salesParams\)\.map\(r => \{[\s\S]*?return \{[\s\S]*?id: `sale-\$\{r\.id\}`,[\s\S]*?created_at: r\.created_at\s*\};\s*\}\);/,
  `const rawSalesRows = await db.prepare(salesQuery).all(...salesParams);
    const salesRows = await Promise.all(rawSalesRows.map(async r => {
      const items = await db.prepare(\`
        SELECT si.*, fp.product_name
        FROM sales_items si
        JOIN finished_products fp ON si.finished_product_id = fp.id
        WHERE si.sale_id = ?
      \`).all(r.id);
      const desc = items.length > 0
        ? items.map(i => \`\${i.product_name} (\${i.quantity} \${i.unit || 'KG'})\`).join(', ')
        : \`Sales: \${r.quantity_kg?.toLocaleString()} KG @ ₹\${r.rate_per_kg}/KG\`;

      return {
        id: \`sale-\${r.id}\`,
        date: r.date,
        voucher_no: r.doc_no || r.sale_code,
        doc_no: r.doc_no || r.sale_code,
        type: 'INVOICE',
        transaction_type: 'Sale / Invoice',
        particulars: \`\${desc} [\${r.payment_type || 'Credit'}]\`,
        description: \`\${desc} [\${r.payment_type || 'Credit'}]\`,
        debit: Number(r.debit.toFixed(2)),
        credit: 0,
        entered_by: r.manager_name || 'Admin',
        created_at: r.created_at
      };
    }));`
);

// 6e. Supplier ledger purRows with inner query:
code = code.replace(
  /const purRows = db\.prepare\(purQuery\)\.all\(\.\.\.purParams\)\.map\(r => \{[\s\S]*?return \{[\s\S]*?id: `pur-\$\{r\.id\}`,[\s\S]*?created_at: r\.created_at\s*\};\s*\}\);/,
  `const rawPurRows = await db.prepare(purQuery).all(...purParams);
    const purRows = await Promise.all(rawPurRows.map(async r => {
      const items = await db.prepare(\`
        SELECT pi.*, rm.name as raw_material_name
        FROM purchase_items pi
        JOIN raw_materials rm ON pi.raw_material_id = rm.id
        WHERE pi.purchase_id = ?
      \`).all(r.id);
      const desc = items.length > 0
        ? items.map(i => \`\${i.raw_material_name} (\${i.quantity} \${i.unit || 'KG'})\`).join(', ')
        : \`Purchase: \${r.quantity_kg?.toLocaleString()} KG @ ₹\${r.rate_per_kg}/KG\`;

      return {
        id: \`pur-\${r.id}\`,
        date: r.date,
        voucher_no: r.doc_no || r.purchase_code,
        doc_no: r.doc_no || r.purchase_code,
        type: 'BILL',
        transaction_type: 'Purchase / Bill',
        particulars: \`\${desc} [\${r.payment_mode || 'Credit'}]\`,
        description: \`\${desc} [\${r.payment_mode || 'Credit'}]\`,
        debit: 0,
        credit: Number(r.credit.toFixed(2)),
        entered_by: r.manager_name || 'Admin',
        created_at: r.created_at
      };
    }));`
);

// 6f. Customer outstanding summary rows
code = code.replace(
  /const rows = customers\.map\(c => \{[\s\S]*?status: netOutstanding > 0 \? 'RECEIVABLE' : \(netOutstanding < 0 \? 'ADVANCE' : 'CLEAR'\)\s*\}\;\s*\}\);/,
  `const rows = await Promise.all(customers.map(async c => {
      const baseOpening = Number(c.opening_balance || 0);
      const isCredit = (c.opening_balance_type === 'CREDIT');
      const opening = isCredit ? -baseOpening : baseOpening;

      const salesRow = (await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE customer_id = ? AND is_voided = 0').get(c.id)) || {};
      const recRow = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'CUSTOMER' AND party_id = ? AND is_voided = 0").get(c.id)) || {};
      const salesSum = Number(salesRow.total || 0);
      const receiptsSum = Number(recRow.total || 0);
      const netOutstanding = Number((opening + salesSum - receiptsSum).toFixed(2));

      return {
        customerId: c.id,
        customerCode: c.customer_code,
        customerName: c.name,
        customerType: c.customer_type || 'Regular',
        phone: c.phone || '—',
        gstNumber: c.gst_number || 'URP',
        city: c.city || '—',
        state: c.state || 'Gujarat',
        creditLimit: c.credit_limit || 0,
        openingBalance: opening,
        totalSales: Number(salesSum.toFixed(2)),
        totalReceipts: Number(receiptsSum.toFixed(2)),
        netOutstanding,
        status: netOutstanding > 0 ? 'DUE' : (netOutstanding < 0 ? 'ADVANCE' : 'CLEAR')
      };
    }));`
);

// 6g. Supplier outstanding summary rows
code = code.replace(
  /const rows = suppliers\.map\(s => \{[\s\S]*?status: netPayable > 0 \? 'PAYABLE' : \(netPayable < 0 \? 'ADVANCE' : 'CLEAR'\)\s*\}\;\s*\}\);/,
  `const rows = await Promise.all(suppliers.map(async s => {
      const baseOpening = Number(s.opening_balance || 0);
      const isDebit = (s.opening_balance_type === 'DEBIT');
      const opening = isDebit ? -baseOpening : baseOpening;

      const purRow = (await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE supplier_id = ? AND is_voided = 0').get(s.id)) || {};
      const payRow = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ? AND is_voided = 0").get(s.id)) || {};
      const purchasesSum = Number(purRow.total || 0);
      const paymentsSum = Number(payRow.total || 0);
      const netPayable = Number((opening + purchasesSum - paymentsSum).toFixed(2));

      return {
        supplierId: s.id,
        supplierCode: s.supplier_code,
        supplierName: s.name,
        supplierType: s.supplier_type || 'Regular',
        phone: s.phone || '—',
        gstNumber: s.gst_number || 'URP',
        city: s.city || '—',
        state: s.state || 'Gujarat',
        openingBalance: opening,
        totalPurchases: Number(purchasesSum.toFixed(2)),
        totalPayments: Number(paymentsSum.toFixed(2)),
        netPayable,
        status: netPayable > 0 ? 'PAYABLE' : (netPayable < 0 ? 'ADVANCE' : 'CLEAR')
      };
    }));`
);

// 6h. CA export customer outstanding
code = code.replace(
  /data = customers\.map\(c => \{[\s\S]*?const salesSum = db\.prepare\('SELECT COALESCE\(SUM\(total_amount\), 0\) as total FROM sales WHERE customer_id = \? AND is_voided = 0'\)\.get\(c\.id\)\.total;[\s\S]*?const recsSum = db\.prepare\("SELECT COALESCE\(SUM\(amount\), 0\) as total FROM payments WHERE party_type = 'CUSTOMER' AND party_id = \? AND is_voided = 0"\)\.get\(c\.id\)\.total;[\s\S]*?'Status': net > 0 \? 'RECEIVABLE' : \(net < 0 \? 'ADVANCE' : 'CLEAR'\)\s*\};\s*\}\);/,
  `data = await Promise.all(customers.map(async c => {
        const baseOpening = Number(c.opening_balance || 0);
        const isCredit = (c.opening_balance_type === 'CREDIT');
        const opening = isCredit ? -baseOpening : baseOpening;
        const salesRow = (await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE customer_id = ? AND is_voided = 0').get(c.id)) || {};
        const recsRow = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'CUSTOMER' AND party_id = ? AND is_voided = 0").get(c.id)) || {};
        const salesSum = Number(salesRow.total || 0);
        const recsSum = Number(recsRow.total || 0);
        const net = Number((opening + salesSum - recsSum).toFixed(2));
        return {
          'Customer Code': c.customer_code,
          'Customer Name': c.name,
          'Phone': c.phone || '—',
          'GSTIN': c.gst_number || 'URP',
          'City': c.city || '—',
          'State': c.state || 'Gujarat',
          'Opening Balance': opening,
          'Total Invoiced': Number(salesSum.toFixed(2)),
          'Total Received': Number(recsSum.toFixed(2)),
          'Closing Balance': net,
          'Status': net > 0 ? 'RECEIVABLE' : (net < 0 ? 'ADVANCE' : 'CLEAR')
        };
      }));`
);

// 6i. CA export supplier outstanding
code = code.replace(
  /data = suppliers\.map\(s => \{[\s\S]*?const purSum = db\.prepare\('SELECT COALESCE\(SUM\(total_amount\), 0\) as total FROM raw_material_purchases WHERE supplier_id = \? AND is_voided = 0'\)\.get\(s\.id\)\.total;[\s\S]*?const paySum = db\.prepare\("SELECT COALESCE\(SUM\(amount\), 0\) as total FROM payments WHERE party_type = 'SUPPLIER' AND party_id = \? AND is_voided = 0"\)\.get\(s\.id\)\.total;[\s\S]*?'Status': net > 0 \? 'PAYABLE' : \(net < 0 \? 'ADVANCE' : 'CLEAR'\)\s*\};\s*\}\);/,
  `data = await Promise.all(suppliers.map(async s => {
        const baseOpening = Number(s.opening_balance || 0);
        const isDebit = (s.opening_balance_type === 'DEBIT');
        const opening = isDebit ? -baseOpening : baseOpening;
        const purRow = (await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE supplier_id = ? AND is_voided = 0').get(s.id)) || {};
        const payRow = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ? AND is_voided = 0").get(s.id)) || {};
        const purSum = Number(purRow.total || 0);
        const paySum = Number(payRow.total || 0);
        const net = Number((opening + purSum - paySum).toFixed(2));
        return {
          'Supplier Code': s.supplier_code,
          'Supplier Name': s.name,
          'Phone': s.phone || '—',
          'GSTIN': s.gst_number || 'URP',
          'City': s.city || '—',
          'State': s.state || 'Gujarat',
          'Opening Balance': opening,
          'Total Purchased': Number(purSum.toFixed(2)),
          'Total Paid': Number(paySum.toFixed(2)),
          'Closing Balance': net,
          'Status': net > 0 ? 'PAYABLE' : (net < 0 ? 'ADVANCE' : 'CLEAR')
        };
      }));`
);

// 6j. Convert simple chained .map calls:
// payRows, cashSales, cashReceipts, cashPurchases, cashPayments, bankSales, bankReceipts, bankPurchases, bankPayments
const simpleMapQueries = [
  'const payRows = db.prepare(payQuery).all(...payParams).map',
  'const cashSales = db.prepare(salesQuery).all(...salesParams).map',
  'const cashReceipts = db.prepare(recQuery).all(...recParams).map',
  'const cashPurchases = db.prepare(purQuery).all(...purParams).map',
  'const cashPayments = db.prepare(payQuery).all(...payParams).map',
  'const bankSales = db.prepare(salesQuery).all(...salesParams).map',
  'const bankReceipts = db.prepare(recQuery).all(...recParams).map',
  'const bankPurchases = db.prepare(purQuery).all(...purParams).map',
  'const bankPayments = db.prepare(payQuery).all(...payParams).map',
];

for (const pattern of simpleMapQueries) {
  const varName = pattern.split(' ')[1];
  const queryName = pattern.split('(')[1].split(')')[0];
  const paramsName = pattern.split('...')[1].split(')')[0];
  const searchStr = `const ${varName} = db.prepare(${queryName}).all(...${paramsName}).map`;
  const replaceStr = `const ${varName} = (await db.prepare(${queryName}).all(...${paramsName})).map`;
  code = code.replace(searchStr, replaceStr);
}

// 7. Chained .get(...).count / .get(...).total / .get(...).c
// Replace `db.prepare(...).get(...).count` with `((await db.prepare(...).get(...)) || {}).count`
code = code.replace(
  /(db\.prepare\([^)]+\)\.get\([^)]*\))\.count/g,
  `((await $1) || {}).count`
);
code = code.replace(
  /(db\.prepare\([^)]+\)\.get\([^)]*\))\.total/g,
  `((await $1) || {}).total`
);
code = code.replace(
  /(db\.prepare\([^)]+\)\.get\([^)]*\))\.c/g,
  `((await $1) || {}).c`
);

// 8. General db.prepare calls: replace db.prepare(...).(all|get|run)( with await db.prepare(...).(all|get|run)(
code = code.replace(
  /\b(db\.prepare\(\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|[a-zA-Z0-9_]+)\s*\)\.(all|get|run)\()/g,
  (match) => `await ${match}`
);

// Also for ALL statement handles: update, insertItem, insertMov, insertOutput, insertFGMovement, getItems, getOutputs, getConsumed, getPurItems, getProdOutputs, getSaleItems
code = code.replace(
  /\b(update|insertItem|insertMov|insertOutput|insertFGMovement|getItems|getOutputs|getConsumed|getPurItems|getProdOutputs|getSaleItems)\.(run|all|get)\(/g,
  (match) => `await ${match}`
);

// 9. Await getNextCode, getRawMaterialStock, getFinishedGoodStock
code = code.replace(
  /\b(getNextCode|getRawMaterialStock|getFinishedGoodStock)\s*\(/g,
  (match) => `await ${match}`
);

// 10. In PUT /api/company/settings: add await refreshCompanySettings()
code = code.replace(
  /res\.json\(\{\s*success:\s*true,\s*message:\s*'Company settings updated successfully',\s*settings:\s*getCompanySettings\(\)\s*\}\);/,
  `await refreshCompanySettings();
    res.json({
      success: true,
      message: 'Company settings updated successfully',
      settings: getCompanySettings()
    });`
);

// 11. Replace server startup at the bottom
code = code.replace(
  /app\.listen\(PORT,\s*\(\)\s*=>\s*\{[\s\S]*?\}\);/,
  `async function startServer() {
  await initDb();
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(\`TRIPAL ERP Server running on port \${PORT}\`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };`
);

// Clean up any double/multiple `await await`
while (code.includes('await await')) {
  code = code.replace(/await\s+await/g, 'await');
}

const outPath = path.resolve(__dirname, '../server/index.js');
fs.writeFileSync(outPath, code, 'utf8');
console.log('Conversion completed! Wrote', code.length, 'bytes to', outPath);
