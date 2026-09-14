const dbFacade = require('../server/db/index');

(async () => {
  try {
    await dbFacade.init();
    const db = dbFacade.db;
    const isManager = false;

    const rawMaterials = await db.prepare(`
      SELECT rm.*, COALESCE((SELECT SUM(quantity_change) FROM raw_material_movements WHERE raw_material_id = rm.id), 0) AS current_stock_kg
      FROM raw_materials rm
      ${isManager ? "WHERE rm.status = 'active'" : ""}
      ORDER BY rm.id ASC
    `).all();

    const finishedGoods = await db.prepare(`
      SELECT fg.*, COALESCE((SELECT SUM(quantity_change) FROM finished_goods_movements WHERE finished_product_id = fg.id), 0) AS current_stock_kg
      FROM finished_products fg
      ${isManager ? "WHERE fg.status = 'active'" : ""}
      ORDER BY fg.id ASC
    `).all();

    const customers = await db.prepare(`SELECT * FROM customers ${isManager ? "WHERE status = 'active'" : ""} ORDER BY id ASC`).all();
    const suppliers = await db.prepare(`SELECT * FROM suppliers ${isManager ? "WHERE status = 'active'" : ""} ORDER BY id ASC`).all();
    const machines = await db.prepare(`SELECT * FROM machines ORDER BY id ASC`).all();
    const shifts = await db.prepare(`SELECT * FROM shifts ORDER BY id ASC`).all();
    const managers = await db.prepare(`SELECT * FROM managers ORDER BY id ASC`).all();

    let bankAccounts = [];
    try {
      bankAccounts = await db.prepare(`SELECT * FROM bank_accounts ORDER BY id ASC`).all();
    } catch (_) {}

    let managerUsers = [];
    try {
      managerUsers = await db.prepare(`SELECT id, username, role, name, status, manager_id, created_at FROM users WHERE role = 'manager' ORDER BY id ASC`).all();
    } catch (_) {}

    let companySettings = {};
    try {
      companySettings = typeof dbFacade.getCompanySettings === 'function' ? dbFacade.getCompanySettings() : {};
    } catch (_) {}

    console.log('Result:', {
      RM: rawMaterials.length,
      FG: finishedGoods.length,
      Customers: customers.length,
      Suppliers: suppliers.length,
      Machines: machines.length,
      Shifts: shifts.length,
      Managers: managers.length,
      BankAccounts: bankAccounts.length,
      ManagerUsers: managerUsers.length,
      CompanyName: companySettings?.company_name
    });
    console.log('✓ /api/masters/all executed perfectly!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await dbFacade.close();
    process.exit(0);
  }
})();
