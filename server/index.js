const express = require('express');
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
} = require('./db/index');

const app = express();
const PORT = process.env.PORT || 5000;

// Netlify Functions serverless path routing support
// Normalizes any /.netlify/functions/api prefix to /api so all Express routes match
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  }
  next();
});

// Configure CORS for Local Development & Netlify Production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  process.env.CLIENT_URL,
  process.env.URL,
  process.env.DEPLOY_PRIME_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests without Origin (same-origin, mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Permissive origin in local development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, allow configured origins or *.netlify.app domains
    const isAllowed = allowedOrigins.some(allowed => origin === allowed) ||
      /^https:\/\/[a-zA-Z0-9-]+\.netlify\.app$/.test(origin);

    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not permitted by CORS policy`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-manager-token']
}));

app.use(express.json());

// (runTransaction is imported from ./db/index and is fully async)

// -------------------------------------------------------------
// GST CALCULATION & NUMBER TO WORDS HELPERS
// -------------------------------------------------------------
function calculateGstBreakdown({ taxableAmount, gstPercent = 18, partyState = 'Gujarat', partyGstin = '', isInterState = null }) {
  const taxAmt = Number(taxableAmount.toFixed(2));
  const gstPct = Number(gstPercent);
  const totalGst = Number(((taxAmt * gstPct) / 100).toFixed(2));
  const grandTotal = Number((taxAmt + totalGst).toFixed(2));

  const company = getCompanySettings();
  const companyStateCode = String(company.company_state_code || '24').trim();
  const companyState = String(company.company_state || 'Gujarat').trim().toLowerCase();

  let isIntraState = true;
  if (isInterState !== null && isInterState !== undefined) {
    isIntraState = !isInterState;
  } else {
    const cleanGstin = String(partyGstin || '').trim();
    if (cleanGstin.length >= 2 && /^\d{2}/.test(cleanGstin)) {
      // First 2 digits of GSTIN are legal state code
      isIntraState = (cleanGstin.substring(0, 2) === companyStateCode);
    } else if (partyState && partyState.trim()) {
      isIntraState = (partyState.trim().toLowerCase() === companyState);
    }
  }

  let cgst = 0, sgst = 0, igst = 0;
  if (isIntraState) {
    cgst = Number((totalGst / 2).toFixed(2));
    sgst = Number((totalGst - cgst).toFixed(2));
    igst = 0;
  } else {
    cgst = 0;
    sgst = 0;
    igst = totalGst;
  }

  return {
    taxableAmount: taxAmt,
    gstPercent: gstPct,
    totalGst,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    grandTotal,
    isIntraState
  };
}

function numberToWords(num) {
  if (!num || isNaN(num)) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if ((n = n.toString()).length > 9) return 'Overflow';
    const n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n_array) return '';
    let str = '';
    str += (Number(n_array[1]) !== 0) ? (a[Number(n_array[1])] || `${b[n_array[1][0]]} ${a[n_array[1][1]]}`) + 'Crore ' : '';
    str += (Number(n_array[2]) !== 0) ? (a[Number(n_array[2])] || `${b[n_array[2][0]]} ${a[n_array[2][1]]}`) + 'Lakh ' : '';
    str += (Number(n_array[3]) !== 0) ? (a[Number(n_array[3])] || `${b[n_array[3][0]]} ${a[n_array[3][1]]}`) + 'Thousand ' : '';
    str += (Number(n_array[4]) !== 0) ? (a[Number(n_array[4])] || `${b[n_array[4][0]]} ${a[n_array[4][1]]}`) + 'Hundred ' : '';
    str += (Number(n_array[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n_array[5])] || `${b[n_array[5][0]]} ${a[n_array[5][1]]}`) : '';
    return str.trim();
  }

  const [rupees, paise] = num.toFixed(2).split('.');
  let words = inWords(Number(rupees)) + ' Rupees';
  if (Number(paise) > 0) {
    words += ' and ' + inWords(Number(paise)) + ' Paise';
  }
  return words + ' Only';
}


// -------------------------------------------------------------
// ROLE-BASED AUTHENTICATION & ACCESS CONTROL
// -------------------------------------------------------------
//
// Authentication supports TWO mechanisms:
//   1. Web login session token (Admin & Manager web browser login)
//      → Header: Authorization: Bearer <session_token>
//      → Token stored in users.session_token (issued at /api/auth/login)
//   2. Legacy mobile APK manager token (backward compat, mobile-only)
//      → Header: x-manager-token: <manager_token>
//      → Token stored in managers.manager_token
//
// For ALL write operations (PUT, PATCH, DELETE), manager role returns HTTP 403.
// The backend enforces this; the frontend hiding is supplemental only.

const ALL_MANAGER_MODULES = [
  'orders', 'purchases', 'consumptions', 'productions', 'sales',
  'payments', 'attendance', 'ledger', 'outstanding', 'masters'
];

function parsePermissions(raw) {
  if (!raw) return [...ALL_MANAGER_MODULES];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  return [...ALL_MANAGER_MODULES];
}

function checkManagerModule(moduleKey, moduleName) {
  return (req, res, next) => {
    if (req.role === 'manager') {
      const perms = req.managerPermissions || ALL_MANAGER_MODULES;
      if (!perms.includes(moduleKey)) {
        return res.status(403).json({
          error: `Access Denied: You do not have permission to access "${moduleName}". Please contact your administrator.`
        });
      }
    }
    next();
  };
}

async function authenticateRole(req, res, next) {
  // Support explicit x-user-role header for testing / API integration
  const overrideRole = req.headers['x-user-role'];
  if (overrideRole === 'manager') {
    req.role = 'manager';
    req.managerPermissions = [...ALL_MANAGER_MODULES];
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(403).json({
        error: 'Access denied. Managers have entry-only permission. Editing and deletion are restricted to Admin.'
      });
    }
    return next();
  }

  // --- (1) Bearer token: web session for admin or manager ---
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    if (user.status && user.status !== 'active') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact admin.' });
    }
    req.role = user.role; // 'admin' or 'manager'
    req.webUser = user;   // full user record
    // For manager role: attach manager record if linked
    if (user.role === 'manager') {
      // manager_id links users table row to managers table row
      const mgr = user.manager_id
        ? await db.prepare('SELECT * FROM managers WHERE id = ?').get(user.manager_id)
        : await db.prepare('SELECT * FROM managers WHERE LOWER(name) = LOWER(?)').get(user.name);
      req.manager = mgr || { id: null, name: user.name, device_id: 'web', status: 'active' };
      req.managerPermissions = parsePermissions(user.permissions || (mgr ? mgr.permissions : null));
      // Block ALL modification attempts by manager at API level
      if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return res.status(403).json({
          error: 'Access denied. Managers have entry-only permission. Editing and deletion are restricted to Admin.'
        });
      }
    }
    return next();
  }

  // --- (2) Legacy x-manager-token: mobile APK manager authentication ---
  const managerToken = req.headers['x-manager-token'];
  if (managerToken) {
    const manager = await getManagerByToken(managerToken);
    if (!manager) {
      return res.status(401).json({ error: 'Invalid or unrecognized manager token. Please re-register.' });
    }
    if (manager.status !== 'active') {
      return res.status(403).json({ error: 'Manager account has been deactivated by Admin. Please contact factory management.' });
    }
    req.role = 'manager';
    req.manager = manager;
    req.managerPermissions = parsePermissions(manager.permissions);
    // Strict Manager Restriction: Manager is entry-only.
    // ANY attempt by manager to PUT, PATCH, or DELETE is unconditionally blocked with HTTP 403.
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(403).json({
        error: 'You have entry permission only. Modification and deletion are restricted to Admin.'
      });
    }
    return next();
  }

  // --- (3) No token: treat as unauthenticated Admin (legacy fallback for same-origin web) ---
  // In production this should be locked down. For now, allow requests without a header
  // to be treated as admin (same-origin web panel without explicit auth header).
  req.role = 'admin';
  next();
}

function requireAdmin(req, res, next) {
  if (req.role === 'manager') {
    return res.status(403).json({
      error: 'Access denied. Managers have entry-only permission. Modification and deletion are restricted to Admin.'
    });
  }
  next();
}

app.use(authenticateRole);

// -------------------------------------------------------------
// AUTHENTICATION API (Admin + Manager Web Login)
// -------------------------------------------------------------

const crypto = require('crypto');

function hashPassword(plainText) {
  return crypto.createHash('sha256').update(String(plainText).trim()).digest('hex');
}

function verifyPassword(plainText, storedPassword) {
  if (!storedPassword || !plainText) return false;
  const computed = hashPassword(plainText);
  if (storedPassword === computed) return true;
  return storedPassword === plainText;
}

// Unified login for both Admin and Manager roles.
// Issues a Bearer token stored in users.session_token.
// The frontend must send:  Authorization: Bearer <token>  on all subsequent requests.
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const cleanUser = username.trim();
    const user = await db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUser);

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status && user.status !== 'active') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
    }

    // Generate a unique session token and persist it
    const token = `${user.role}_sess_` + Math.random().toString(36).substring(2, 14) + '_' + Date.now().toString(36);
    await db.prepare('UPDATE users SET session_token = ? WHERE id = ?').run(token, user.id);

    // If manager role, get manager record for context
    let managerInfo = null;
    if (user.role === 'manager') {
      managerInfo = user.manager_id
        ? await db.prepare('SELECT id, name, phone, status, permissions FROM managers WHERE id = ?').get(user.manager_id)
        : await db.prepare('SELECT id, name, phone, status, permissions FROM managers WHERE LOWER(name) = LOWER(?)').get(user.name);
    }

    const effectivePermissions = parsePermissions(user.permissions || (managerInfo ? managerInfo.permissions : null));

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,  // 'admin' or 'manager'
        managerId: managerInfo ? managerInfo.id : null,
        managerName: managerInfo ? managerInfo.name : (user.role === 'manager' ? user.name : null),
        permissions: effectivePermissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout – invalidate the session token
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await db.prepare('UPDATE users SET session_token = NULL WHERE session_token = ?').run(token);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current logged-in user info
app.get('/api/auth/me', async (req, res) => {
  try {
    if (req.webUser) {
      let permissions = null;
      if (req.webUser.role === 'manager') {
        permissions = req.managerPermissions || parsePermissions(req.webUser.permissions);
      }
      return res.json({
        id: req.webUser.id,
        username: req.webUser.username,
        name: req.webUser.name,
        role: req.webUser.role,
        permissions
      });
    }
    if (req.manager) {
      return res.json({
        id: req.manager.id,
        name: req.manager.name,
        role: 'manager',
        permissions: parsePermissions(req.manager.permissions)
      });
    }
    res.json({ role: req.role || 'admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create manager web login account
app.post('/api/auth/create-manager-user', requireAdmin, async (req, res) => {
  try {
    const { username, password, name, display_name, phone, managerId, permissions } = req.body;
    const finalName = (name || display_name || username || '').trim();
    if (!username || !password || !finalName) {
      return res.status(400).json({ error: 'Username, password, and name are required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const cleanUsername = username.trim();
    const existing = await db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ error: `Username "${cleanUsername}" is already taken` });
    }

    const permsJson = JSON.stringify(Array.isArray(permissions) && permissions.length > 0 ? permissions : ALL_MANAGER_MODULES);

    let resolvedManagerId = managerId || null;
    if (!resolvedManagerId) {
      // Find or create matching manager in managers table
      let mgr = await db.prepare('SELECT id FROM managers WHERE LOWER(name) = LOWER(?)').get(finalName);
      if (!mgr) {
        const infoMgr = await db.prepare(`
          INSERT INTO managers (name, phone, device_id, status, permissions)
          VALUES (?, ?, ?, 'active', ?)
        `).run(finalName, phone || '', 'WEB-' + cleanUsername.toUpperCase(), permsJson);
        resolvedManagerId = infoMgr.lastInsertRowid;
      } else {
        resolvedManagerId = mgr.id;
        await db.prepare('UPDATE managers SET phone = COALESCE(?, phone), permissions = ? WHERE id = ?').run(phone || null, permsJson, mgr.id);
      }
    } else {
      await db.prepare('UPDATE managers SET permissions = ? WHERE id = ?').run(permsJson, resolvedManagerId);
    }

    const hashedPassword = hashPassword(password);
    const info = await db.prepare(`
      INSERT INTO users (username, password, role, name, manager_id, status, permissions)
      VALUES (?, ?, 'manager', ?, ?, 'active', ?)
    `).run(cleanUsername, hashedPassword, finalName, resolvedManagerId, permsJson);

    res.status(201).json({
      id: info.lastInsertRowid,
      username: cleanUsername,
      name: finalName,
      display_name: finalName,
      role: 'manager',
      manager_id: resolvedManagerId,
      permissions: parsePermissions(permsJson)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: List all manager web login accounts
app.get('/api/auth/manager-users', requireAdmin, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT u.id, u.username, u.name, u.name AS display_name, u.role, u.status, u.created_at, u.manager_id, u.permissions,
             COALESCE(m.name, u.name) AS manager_name, m.phone, m.phone AS manager_phone, m.permissions AS manager_perms
      FROM users u
      LEFT JOIN managers m ON u.manager_id = m.id
      WHERE u.role = 'manager'
      ORDER BY u.id ASC
    `).all();
    const formatted = rows.map(r => ({
      ...r,
      permissions: parsePermissions(r.permissions || r.manager_perms)
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update manager web account permissions
app.put('/api/auth/manager-users/:id/permissions', requireAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array of module keys' });
    }
    const permsJson = JSON.stringify(permissions);
    const user = await db.prepare('SELECT id, name, manager_id FROM users WHERE id = ? AND role = \'manager\'').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Manager user not found' });

    await db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(permsJson, req.params.id);
    if (user.manager_id) {
      await db.prepare('UPDATE managers SET permissions = ? WHERE id = ?').run(permsJson, user.manager_id);
    } else if (user.name) {
      await db.prepare('UPDATE managers SET permissions = ? WHERE LOWER(name) = LOWER(?)').run(permsJson, user.name);
    }

    res.json({ success: true, id: Number(req.params.id), permissions });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Deactivate / reactivate manager web account
app.put('/api/auth/manager-users/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }
    await db.prepare('UPDATE users SET status = ?, session_token = CASE WHEN ? = \'inactive\' THEN NULL ELSE session_token END WHERE id = ? AND role = \'manager\'').run(status, status, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Reset manager web account password
app.put('/api/auth/manager-users/:id/password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }
    const hashedPassword = hashPassword(newPassword);
    await db.prepare('UPDATE users SET password = ?, session_token = NULL WHERE id = ? AND role = \'manager\'').run(hashedPassword, req.params.id);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Delete manager web account (only if no transactions)
app.delete('/api/auth/manager-users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ? AND role = \'manager\'').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Manager user not found' });
    await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Change own password securely
app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long' });
    }
    const admin = await db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
    if (!admin || !verifyPassword(currentPassword, admin.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hashedPassword = hashPassword(newPassword);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, admin.id);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 1. DASHBOARD & STATS API
// -------------------------------------------------------------
app.get('/api/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = today.slice(0, 7) + '-01';

    // 1. RM Stock Total
    const rmStockRow = await db.prepare(`
      SELECT COALESCE(SUM(quantity_change), 0) AS total_kg
      FROM raw_material_movements
    `).get();

    // 2. FG Stock Total
    const fgStockRow = await db.prepare(`
      SELECT COALESCE(SUM(quantity_change), 0) AS total_kg
      FROM finished_goods_movements
    `).get();

    // 3. Today's Purchases
    const todayPur = await db.prepare(`
      SELECT COALESCE(SUM(quantity_kg), 0) as total_kg, COALESCE(SUM(total_amount), 0) as total_amount, COUNT(*) as count
      FROM raw_material_purchases
      WHERE date = ? AND (is_voided = 0 OR is_voided IS NULL)
    `).get(today);

    // 4. Today's Production & Wastage
    const todayProd = await db.prepare(`
      SELECT COALESCE(SUM(total_finished_kg), 0) as total_finished_kg,
             COALESCE(SUM(raw_material_used_kg), 0) as total_rm_used_kg,
             COALESCE(SUM(total_wastage_kg), 0) as total_wastage_kg,
             COUNT(*) as count
      FROM production_batches
      WHERE date = ? AND (is_voided = 0 OR is_voided IS NULL)
    `).get(today);

    // 5. Today's Sales
    const todaySale = await db.prepare(`
      SELECT COALESCE(SUM(quantity_kg), 0) as total_kg, COALESCE(SUM(total_amount), 0) as total_amount, COUNT(*) as count
      FROM sales
      WHERE date = ? AND (is_voided = 0 OR is_voided IS NULL)
    `).get(today);

    // 6. Monthly Production
    const monthlyProd = await db.prepare(`
      SELECT COALESCE(SUM(total_finished_kg), 0) as total_finished_kg,
             COALESCE(SUM(raw_material_used_kg), 0) as total_rm_used_kg,
             COALESCE(SUM(total_wastage_kg), 0) as total_wastage_kg
      FROM production_batches
      WHERE date >= ? AND (is_voided = 0 OR is_voided IS NULL)
    `).get(firstDayOfMonth);

    // 7. Monthly Sales
    const monthlySale = await db.prepare(`
      SELECT COALESCE(SUM(quantity_kg), 0) as total_kg, COALESCE(SUM(total_amount), 0) as total_amount
      FROM sales
      WHERE date >= ? AND (is_voided = 0 OR is_voided IS NULL)
    `).get(firstDayOfMonth);

    // 8. Trends (Last 7 Days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      last7Days.push(d);
    }

    const minDate = last7Days[0];

    const rawRm = (await db.prepare(`
      SELECT date, COALESCE(SUM(quantity_kg), 0) as kg, COALESCE(SUM(total_amount), 0) as amount
      FROM raw_material_purchases
      WHERE date >= ? AND (is_voided = 0 OR is_voided IS NULL)
      GROUP BY date
    `).all(minDate)) || [];
    const rmMap = new Map(rawRm.map(r => [r.date, r]));

    const rmTrend = last7Days.map(dateStr => {
      const row = rmMap.get(dateStr) || { kg: 0, amount: 0 };
      return { date: dateStr.slice(5), kg: Number(row.kg || 0), amount: Number(row.amount || 0) };
    });

    const rawProd = (await db.prepare(`
      SELECT date,
             COALESCE(SUM(raw_material_used_kg), 0) as rm_used,
             COALESCE(SUM(total_finished_kg), 0) as finished_kg,
             COALESCE(SUM(total_wastage_kg), 0) as wastage_kg
      FROM production_batches
      WHERE date >= ? AND (is_voided = 0 OR is_voided IS NULL)
      GROUP BY date
    `).all(minDate)) || [];
    const prodMap = new Map(rawProd.map(r => [r.date, r]));

    const prodTrend = last7Days.map(dateStr => {
      const row = prodMap.get(dateStr) || { rm_used: 0, finished_kg: 0, wastage_kg: 0 };
      return {
        date: dateStr.slice(5),
        rmUsed: Number(row.rm_used || 0),
        finishedKg: Number(row.finished_kg || 0),
        wastageKg: Number(row.wastage_kg || 0)
      };
    });

    const rawSales = (await db.prepare(`
      SELECT date, COALESCE(SUM(quantity_kg), 0) as kg, COALESCE(SUM(total_amount), 0) as amount
      FROM sales
      WHERE date >= ? AND (is_voided = 0 OR is_voided IS NULL)
      GROUP BY date
    `).all(minDate)) || [];
    const salesMap = new Map(rawSales.map(r => [r.date, r]));

    const salesTrend = last7Days.map(dateStr => {
      const row = salesMap.get(dateStr) || { kg: 0, amount: 0 };
      return { date: dateStr.slice(5), kg: Number(row.kg || 0), amount: Number(row.amount || 0) };
    });

    // 9. Wastage Reason Breakdown
    const wastageReasons = await db.prepare(`
      SELECT COALESCE(wastage_reason, 'Other') as reason, SUM(total_wastage_kg) as total_kg
      FROM production_batches
      WHERE (is_voided = 0 OR is_voided IS NULL)
      GROUP BY wastage_reason
    `).all();

    res.json({
      rawMaterialStockKg: Number(rmStockRow.total_kg || 0),
      finishedGoodsStockKg: Number(fgStockRow.total_kg || 0),
      todayPurchase: {
        kg: Number(todayPur.total_kg || 0),
        amount: Number(todayPur.total_amount || 0),
        count: Number(todayPur.count || 0)
      },
      todayProduction: {
        finishedKg: Number(todayProd.total_finished_kg || 0),
        rmUsedKg: Number(todayProd.total_rm_used_kg || 0),
        wastageKg: Number(todayProd.total_wastage_kg || 0),
        count: Number(todayProd.count || 0)
      },
      todaySales: {
        kg: Number(todaySale.total_kg || 0),
        amount: Number(todaySale.total_amount || 0),
        count: Number(todaySale.count || 0)
      },
      monthlyProduction: {
        finishedKg: Number(monthlyProd.total_finished_kg || 0),
        rmUsedKg: Number(monthlyProd.total_rm_used_kg || 0),
        wastageKg: Number(monthlyProd.total_wastage_kg || 0)
      },
      monthlySales: {
        kg: Number(monthlySale.total_kg || 0),
        amount: Number(monthlySale.total_amount || 0)
      },
      trends: {
        rmTrend,
        prodTrend,
        salesTrend,
        wastageReasons
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. MASTERS API
// -------------------------------------------------------------

// Consolidated Masters Endpoint — single HTTP request & connection to load all masters
app.get('/api/masters/all', async (req, res) => {
  try {
    const isManager = req.role === 'manager';
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

    let staff = [];
    try {
      staff = await db.prepare(`SELECT * FROM staff ${isManager ? "WHERE status = 'active'" : ""} ORDER BY id ASC`).all();
    } catch (_) {}

    let managerUsers = [];
    try {
      managerUsers = await db.prepare(`SELECT id, username, role, name, status, manager_id, created_at FROM users WHERE role = 'manager' ORDER BY id ASC`).all();
    } catch (_) {}

    let companySettings = {};
    try {
      companySettings = typeof getCompanySettings === 'function' ? getCompanySettings() : {};
    } catch (_) {}

    res.json({
      rawMaterials: rawMaterials || [],
      finishedGoods: finishedGoods || [],
      customers: customers || [],
      suppliers: suppliers || [],
      machines: machines || [],
      shifts: shifts || [],
      managers: managers || [],
      staff: staff || [],
      bankAccounts: bankAccounts || [],
      companySettings: companySettings || {},
      managerUsers: managerUsers || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Raw Materials
app.get('/api/masters/raw-materials', async (req, res) => {
  if (req.role === 'manager') {
    const rows = await db.prepare(`
      SELECT rm.*,
             COALESCE((SELECT SUM(quantity_change) FROM raw_material_movements WHERE raw_material_id = rm.id), 0) AS current_stock_kg
      FROM raw_materials rm
      WHERE rm.status = 'active'
      ORDER BY rm.name ASC
    `).all();
    return res.json(rows);
  }
  const rows = await db.prepare(`
    SELECT rm.*, 
           COALESCE((SELECT SUM(quantity_change) FROM raw_material_movements WHERE raw_material_id = rm.id), 0) AS current_stock_kg
    FROM raw_materials rm
    ORDER BY rm.id ASC
  `).all();
  res.json(rows);
});

// POST: Both Admin and Manager can create raw materials (entry-only permission for Manager)
app.post('/api/masters/raw-materials', checkManagerModule('masters', 'Masters'), async (req, res) => {
  try {
    const { name, category, unit = 'KG', minStockAlert = 1000, hsnCode = '3901', gstPercent = 18 } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    const code = await getNextCode('RM', 'raw_materials', 'code');
    const info = await db.prepare(`
      INSERT INTO raw_materials (code, name, category, unit, min_stock_alert, hsn_code, gst_percent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(code, name, category, unit, Number(minStockAlert), hsnCode || '3901', Number(gstPercent) || 18);
    res.status(201).json({ id: info.lastInsertRowid, code, name, category, unit, min_stock_alert: minStockAlert, hsn_code: hsnCode, gst_percent: gstPercent });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/raw-materials/:id', requireAdmin, async (req, res) => {
  try {
    const { name, category, unit, minStockAlert, hsnCode, gstPercent, status } = req.body;
    await db.prepare(`
      UPDATE raw_materials
      SET name = COALESCE(?, name),
          category = COALESCE(?, category),
          unit = COALESCE(?, unit),
          min_stock_alert = COALESCE(?, min_stock_alert),
          hsn_code = COALESCE(?, hsn_code),
          gst_percent = COALESCE(?, gst_percent),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      name ?? null,
      category ?? null,
      unit ?? null,
      (minStockAlert !== undefined && minStockAlert !== null && minStockAlert !== '') ? Number(minStockAlert) : null,
      hsnCode ?? null,
      (gstPercent !== undefined && gstPercent !== null && gstPercent !== '') ? Number(gstPercent) : null,
      status ?? null,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/raw-materials/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    // Check if used in transactions
    const countPur = (await db.prepare('SELECT COUNT(*) as count FROM raw_material_purchases WHERE raw_material_id = ?').get(id))?.count || 0;
    const countProd = (await db.prepare('SELECT COUNT(*) as count FROM production_batches WHERE raw_material_id = ?').get(id))?.count || 0;
    const countMov = (await db.prepare('SELECT COUNT(*) as count FROM raw_material_movements WHERE raw_material_id = ?').get(id))?.count || 0;

    if (countPur > 0 || countProd > 0 || countMov > 0) {
      return res.status(400).json({
        error: 'Cannot delete raw material with existing transaction history. Please set its status to inactive instead.'
      });
    }

    await db.prepare('DELETE FROM raw_materials WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finished Goods
app.get('/api/masters/finished-goods', async (req, res) => {
  if (req.role === 'manager') {
    const rows = await db.prepare(`
      SELECT fg.*,
             COALESCE((SELECT SUM(quantity_change) FROM finished_goods_movements WHERE finished_product_id = fg.id), 0) AS current_stock_kg
      FROM finished_products fg
      WHERE fg.status = 'active'
      ORDER BY fg.product_code ASC
    `).all();
    return res.json(rows);
  }
  const rows = await db.prepare(`
    SELECT fg.*,
           COALESCE((SELECT SUM(quantity_change) FROM finished_goods_movements WHERE finished_product_id = fg.id), 0) AS current_stock_kg
    FROM finished_products fg
    ORDER BY fg.id ASC
  `).all();
  res.json(rows);
});

// POST: Both Admin and Manager can create finished goods (entry-only permission for Manager)
app.post('/api/masters/finished-goods', checkManagerModule('masters', 'Masters'), async (req, res) => {
  try {
    const { productName = 'Tripal', gsm, widthSize, lengthVal, colour, grade = 'Grade A', unit = 'KG', minStockAlert = 500, hsnCode = '3926', gstPercent = 18 } = req.body;
    if (!gsm || !widthSize || !colour) {
      return res.status(400).json({ error: 'GSM, Width/Size, and Colour are required' });
    }
    const code = await getNextCode('FG', 'finished_products', 'product_code');
    const info = await db.prepare(`
      INSERT INTO finished_products (product_code, product_name, gsm, width_size, length_val, colour, grade, unit, min_stock_alert, hsn_code, gst_percent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(code, productName || 'Tripal', Number(gsm), widthSize, lengthVal || null, colour, grade || 'Grade A', unit || 'KG', Number(minStockAlert) || 500, hsnCode || '3926', Number(gstPercent) || 18);
    res.status(201).json({ id: info.lastInsertRowid, product_code: code });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/finished-goods/:id', requireAdmin, async (req, res) => {
  try {
    const { productName, gsm, widthSize, lengthVal, colour, grade, unit, minStockAlert, hsnCode, gstPercent, status } = req.body;
    await db.prepare(`
      UPDATE finished_products
      SET product_name = COALESCE(?, product_name),
          gsm = COALESCE(?, gsm),
          width_size = COALESCE(?, width_size),
          length_val = COALESCE(?, length_val),
          colour = COALESCE(?, colour),
          grade = COALESCE(?, grade),
          unit = COALESCE(?, unit),
          min_stock_alert = COALESCE(?, min_stock_alert),
          hsn_code = COALESCE(?, hsn_code),
          gst_percent = COALESCE(?, gst_percent),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      productName ?? null,
      (gsm !== undefined && gsm !== null && gsm !== '') ? Number(gsm) : null,
      widthSize ?? null,
      lengthVal ?? null,
      colour ?? null,
      grade ?? null,
      unit ?? null,
      (minStockAlert !== undefined && minStockAlert !== null && minStockAlert !== '') ? Number(minStockAlert) : null,
      hsnCode ?? null,
      (gstPercent !== undefined && gstPercent !== null && gstPercent !== '') ? Number(gstPercent) : null,
      status ?? null,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/finished-goods/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const countProd = (await db.prepare('SELECT COUNT(*) as count FROM production_outputs WHERE finished_product_id = ?').get(id))?.count || 0;
    const countSale = (await db.prepare('SELECT COUNT(*) as count FROM sales WHERE finished_product_id = ?').get(id))?.count || 0;
    const countMov = (await db.prepare('SELECT COUNT(*) as count FROM finished_goods_movements WHERE finished_product_id = ?').get(id))?.count || 0;

    if (countProd > 0 || countSale > 0 || countMov > 0) {
      return res.status(400).json({
        error: 'Cannot delete finished product specification with existing production or sales transactions. Deactivate it instead.'
      });
    }

    await db.prepare('DELETE FROM finished_products WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Customers
app.get('/api/masters/customers', async (req, res) => {
  if (req.role === 'manager') {
    const rows = await db.prepare(`SELECT id, customer_code, name, phone, email, address, billing_address, shipping_address, state, gst_number, customer_type, status FROM customers WHERE status = 'active' ORDER BY name ASC`).all();
    return res.json(rows);
  }
  const rows = await db.prepare(`
    SELECT c.*,
           COALESCE((SELECT SUM(quantity_kg) FROM sales WHERE customer_id = c.id), 0) AS total_purchased_kg,
           COALESCE((SELECT SUM(total_amount) FROM sales WHERE customer_id = c.id), 0) AS total_sales_amount,
           (SELECT MAX(date) FROM sales WHERE customer_id = c.id) AS last_order_date
    FROM customers c
    ORDER BY c.id ASC
  `).all();
  res.json(rows);
});

// POST: Both Admin and Manager can create customers
app.post('/api/masters/customers', checkManagerModule('masters', 'Masters'), async (req, res) => {
  try {
    const {
      name,
      customerCode,
      phone,
      email,
      address,
      billingAddress,
      shippingAddress,
      state = 'Gujarat',
      gstNumber,
      customerType = 'GST Registered',
      openingBalance = 0,
      openingBalanceType = 'Debit',
      remarks
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    const code = customerCode || await getNextCode('CUST', 'customers', 'customer_code');
    const finalBilling = billingAddress || address || null;
    const finalShipping = shippingAddress || address || null;
    const info = await db.prepare(`
      INSERT INTO customers (
        customer_code, name, phone, email, address, billing_address, shipping_address,
        state, gst_number, customer_type, opening_balance, opening_balance_type, remarks, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      code, name, phone || null, email || null, address || finalBilling, finalBilling, finalShipping,
      state || 'Gujarat', gstNumber || null, customerType || 'GST Registered',
      Number(openingBalance) || 0, openingBalanceType || 'Debit', remarks || null
    );
    res.status(201).json({ id: info.lastInsertRowid, customer_code: code, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/customers/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name, customerCode, phone, email, address, billingAddress, shippingAddress,
      state, gstNumber, customerType, openingBalance, openingBalanceType, remarks, status
    } = req.body;
    await db.prepare(`
      UPDATE customers
      SET name = COALESCE(?, name),
          customer_code = COALESCE(?, customer_code),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address = COALESCE(?, address),
          billing_address = COALESCE(?, billing_address),
          shipping_address = COALESCE(?, shipping_address),
          state = COALESCE(?, state),
          gst_number = COALESCE(?, gst_number),
          customer_type = COALESCE(?, customer_type),
          opening_balance = COALESCE(?, opening_balance),
          opening_balance_type = COALESCE(?, opening_balance_type),
          remarks = COALESCE(?, remarks),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      name ?? null, customerCode ?? null, phone ?? null, email ?? null, address ?? null,
      billingAddress ?? null, shippingAddress ?? null, state ?? null, gstNumber ?? null,
      customerType ?? null, (openingBalance !== undefined && openingBalance !== null && openingBalance !== '') ? Number(openingBalance) : null,
      openingBalanceType ?? null, remarks ?? null, status ?? null, req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/customers/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const countSales = (await db.prepare('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?').get(id))?.count || 0;
    if (countSales > 0) {
      return res.status(400).json({
        error: 'Cannot delete customer with sales transaction history. Please deactivate the customer instead.'
      });
    }
    await db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Suppliers
app.get('/api/masters/suppliers', async (req, res) => {
  if (req.role === 'manager') {
    const rows = await db.prepare(`SELECT id, supplier_code, name, phone, email, address, state, gst_number, supplier_type, status FROM suppliers WHERE status = 'active' ORDER BY name ASC`).all();
    return res.json(rows);
  }
  const rows = await db.prepare(`
    SELECT s.*,
           COALESCE((SELECT SUM(quantity_kg) FROM raw_material_purchases WHERE supplier_id = s.id), 0) AS total_supplied_kg,
           COALESCE((SELECT SUM(total_amount) FROM raw_material_purchases WHERE supplier_id = s.id), 0) AS total_purchase_amount
    FROM suppliers s
    ORDER BY s.id ASC
  `).all();
  res.json(rows);
});

// POST: Both Admin and Manager can create suppliers
app.post('/api/masters/suppliers', checkManagerModule('masters', 'Masters'), async (req, res) => {
  try {
    const {
      name,
      supplierCode,
      phone,
      email,
      address,
      state = 'Gujarat',
      gstNumber,
      supplierType = 'GST Registered',
      openingBalance = 0,
      openingBalanceType = 'Credit'
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });
    const code = supplierCode || await getNextCode('SUP', 'suppliers', 'supplier_code');
    const info = await db.prepare(`
      INSERT INTO suppliers (
        supplier_code, name, phone, email, address, state, gst_number, supplier_type, opening_balance, opening_balance_type, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      code, name, phone || null, email || null, address || null, state || 'Gujarat',
      gstNumber || null, supplierType || 'GST Registered', Number(openingBalance) || 0,
      openingBalanceType || 'Credit'
    );
    res.status(201).json({ id: info.lastInsertRowid, supplier_code: code, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/suppliers/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name, supplierCode, phone, email, address, state, gstNumber, supplierType, openingBalance, openingBalanceType, status
    } = req.body;
    await db.prepare(`
      UPDATE suppliers
      SET name = COALESCE(?, name),
          supplier_code = COALESCE(?, supplier_code),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address = COALESCE(?, address),
          state = COALESCE(?, state),
          gst_number = COALESCE(?, gst_number),
          supplier_type = COALESCE(?, supplier_type),
          opening_balance = COALESCE(?, opening_balance),
          opening_balance_type = COALESCE(?, opening_balance_type),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      name ?? null, supplierCode ?? null, phone ?? null, email ?? null, address ?? null,
      state ?? null, gstNumber ?? null, supplierType ?? null,
      (openingBalance !== undefined && openingBalance !== null && openingBalance !== '') ? Number(openingBalance) : null,
      openingBalanceType ?? null, status ?? null, req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/suppliers/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const countPur = (await db.prepare('SELECT COUNT(*) as count FROM raw_material_purchases WHERE supplier_id = ?').get(id))?.count || 0;
    if (countPur > 0) {
      return res.status(400).json({
        error: 'Cannot delete supplier with raw material purchase history. Please deactivate the supplier instead.'
      });
    }
    await db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Machines
app.get('/api/masters/machines', async (req, res) => {
  if (req.role === 'manager') {
    const rows = await db.prepare(`SELECT id, machine_code, name, capacity_kg_per_day, status FROM machines WHERE status = 'active' ORDER BY machine_code ASC`).all();
    return res.json(rows);
  }
  const rows = await db.prepare(`
    SELECT m.*,
           COALESCE((SELECT COUNT(*) FROM production_batches WHERE machine_id = m.id), 0) AS total_batches,
           COALESCE((SELECT SUM(total_finished_kg) FROM production_batches WHERE machine_id = m.id), 0) AS total_produced_kg
    FROM machines m
    ORDER BY m.id ASC
  `).all();
  res.json(rows);
});

// POST: Both Admin and Manager can create machines
app.post('/api/masters/machines', async (req, res) => {
  try {
    const { name, capacityKgPerDay = 5000 } = req.body;
    if (!name) return res.status(400).json({ error: 'Machine name is required' });
    const code = await getNextCode('M', 'machines', 'machine_code');
    const info = await db.prepare(`
      INSERT INTO machines (machine_code, name, capacity_kg_per_day, status)
      VALUES (?, ?, ?, 'active')
    `).run(code, name, Number(capacityKgPerDay));
    res.status(201).json({ id: info.lastInsertRowid, machine_code: code, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/machines/:id', requireAdmin, async (req, res) => {
  try {
    const { name, capacityKgPerDay, status } = req.body;
    await db.prepare(`
      UPDATE machines
      SET name = COALESCE(?, name),
          capacity_kg_per_day = COALESCE(?, capacity_kg_per_day),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(name ?? null, (capacityKgPerDay !== undefined && capacityKgPerDay !== null && capacityKgPerDay !== '') ? Number(capacityKgPerDay) : null, status ?? null, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/machines/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const countBatches = (await db.prepare('SELECT COUNT(*) as count FROM production_batches WHERE machine_id = ?').get(id))?.count || 0;
    if (countBatches > 0) {
      return res.status(400).json({
        error: 'Cannot delete machine with existing production history. Please deactivate it instead.'
      });
    }
    await db.prepare('DELETE FROM machines WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Shifts
app.get('/api/masters/shifts', async (req, res) => {
  if (req.role === 'manager') {
    const rows = await db.prepare(`SELECT id, name, start_time, end_time, status FROM shifts WHERE status = 'active' ORDER BY id ASC`).all();
    return res.json(rows);
  }
  const rows = await db.prepare('SELECT * FROM shifts ORDER BY id ASC').all();
  res.json(rows);
});

// POST: Both Admin and Manager can create shifts
app.post('/api/masters/shifts', async (req, res) => {
  try {
    const { name, startTime, endTime } = req.body;
    if (!name) return res.status(400).json({ error: 'Shift name is required' });
    const info = await db.prepare(`
      INSERT INTO shifts (name, start_time, end_time, status)
      VALUES (?, ?, ?, 'active')
    `).run(name, startTime || null, endTime || null);
    res.status(201).json({ id: info.lastInsertRowid, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/shifts/:id', requireAdmin, async (req, res) => {
  try {
    const { name, startTime, endTime, status } = req.body;
    await db.prepare(`
      UPDATE shifts
      SET name = COALESCE(?, name),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(name ?? null, startTime ?? null, endTime ?? null, status ?? null, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/shifts/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const countBatches = (await db.prepare('SELECT COUNT(*) as count FROM production_batches WHERE shift_id = ?').get(id))?.count || 0;
    if (countBatches > 0) {
      return res.status(400).json({
        error: 'Cannot delete shift with existing production batch records. Please deactivate it instead.'
      });
    }
    await db.prepare('DELETE FROM shifts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Managers
app.get('/api/masters/managers', requireAdmin, async (req, res) => {
  const rows = await db.prepare(`
    SELECT m.*,
           (SELECT COUNT(*) FROM raw_material_purchases WHERE manager_name = m.name) AS purchase_count,
           (SELECT COUNT(*) FROM production_batches WHERE manager_name = m.name) AS production_count,
           (SELECT COUNT(*) FROM sales WHERE manager_name = m.name) AS sales_count,
           COALESCE((SELECT SUM(total_finished_kg) FROM production_batches WHERE manager_name = m.name), 0) AS total_production_kg,
           COALESCE((SELECT SUM(quantity_kg) FROM sales WHERE manager_name = m.name), 0) AS total_sales_kg,
           COALESCE((SELECT SUM(total_wastage_kg) FROM production_batches WHERE manager_name = m.name), 0) AS total_wastage_kg
    FROM managers m
    ORDER BY m.id ASC
  `).all();
  const formatted = rows.map(r => ({
    ...r,
    permissions: parsePermissions(r.permissions)
  }));
  res.json(formatted);
});

// Admin: Update floor manager permissions
app.put('/api/masters/managers/:id/permissions', requireAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array of module keys' });
    }
    const permsJson = JSON.stringify(permissions);
    const mgr = await db.prepare('SELECT id, name FROM managers WHERE id = ?').get(req.params.id);
    if (!mgr) return res.status(404).json({ error: 'Manager not found' });

    await db.prepare('UPDATE managers SET permissions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(permsJson, req.params.id);
    await db.prepare("UPDATE users SET permissions = ? WHERE manager_id = ? OR (role = 'manager' AND LOWER(name) = LOWER(?))").run(permsJson, mgr.id, mgr.name);

    res.json({ success: true, id: Number(req.params.id), permissions });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Manager profile setup / sync from mobile device

// Admin activate/deactivate manager
app.put('/api/masters/managers/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }
    const mgr = await db.prepare('SELECT * FROM managers WHERE id = ?').get(req.params.id);
    if (!mgr) {
      return res.status(404).json({ error: 'Manager not found' });
    }
    await db.prepare('UPDATE managers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('MANAGER', String(req.params.id), 'STATUS_UPDATE', JSON.stringify({ status: mgr.status }), JSON.stringify({ status }), 'Admin');
    res.json({ success: true, id: Number(req.params.id), status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin create manager directly
app.post('/api/masters/managers', requireAdmin, async (req, res) => {
  try {
    const { name, phone, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Manager name is required' });
    }
    const cleanName = name.trim();
    const existing = await db.prepare('SELECT id FROM managers WHERE LOWER(name) = LOWER(?)').get(cleanName);
    if (existing) {
      return res.status(400).json({ error: `Manager with name "${cleanName}" already exists.` });
    }
    const permsJson = JSON.stringify(Array.isArray(permissions) && permissions.length > 0 ? permissions : ALL_MANAGER_MODULES);
    const token = 'mgr_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 10);
    const devId = 'dev-' + Math.random().toString(36).substring(2, 8);
    const info = await db.prepare(`
      INSERT INTO managers (name, device_id, phone, status, manager_token, permissions)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run(cleanName, devId, phone || null, token, permsJson);
    res.status(201).json({ id: info.lastInsertRowid, name: cleanName, device_id: devId, phone, status: 'active', manager_token: token, permissions: parsePermissions(permsJson) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin edit manager
app.put('/api/masters/managers/:id', requireAdmin, async (req, res) => {
  try {
    const { name, phone, status } = req.body;
    const mgr = await db.prepare('SELECT * FROM managers WHERE id = ?').get(req.params.id);
    if (!mgr) return res.status(404).json({ error: 'Manager not found' });

    await db.prepare(`
      UPDATE managers
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name ? name.trim() : null, phone ?? null, status ?? null, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin delete manager
app.delete('/api/masters/managers/:id', requireAdmin, async (req, res) => {
  try {
    const mgr = await db.prepare('SELECT * FROM managers WHERE id = ?').get(req.params.id);
    if (!mgr) return res.status(404).json({ error: 'Manager not found' });

    const purCount = (await db.prepare('SELECT COUNT(*) as count FROM raw_material_purchases WHERE manager_name = ?').get(mgr.name))?.count || 0;
    const prodCount = (await db.prepare('SELECT COUNT(*) as count FROM production_batches WHERE manager_name = ?').get(mgr.name))?.count || 0;
    const saleCount = (await db.prepare('SELECT COUNT(*) as count FROM sales WHERE manager_name = ?').get(mgr.name))?.count || 0;

    if (purCount > 0 || prodCount > 0 || saleCount > 0) {
      return res.status(400).json({
        error: `Cannot delete manager "${mgr.name}" who has recorded entries in factory audit trails (${purCount} purchases, ${prodCount} batches, ${saleCount} sales). Deactivate them instead.`
      });
    }

    await db.prepare('DELETE FROM managers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/managers/register', async (req, res) => {
  try {
    const { name, deviceId, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Manager name is required' });
    }
    const cleanName = name.trim();
    let manager = await db.prepare('SELECT * FROM managers WHERE LOWER(name) = LOWER(?)').get(cleanName);

    if (manager) {
      if (manager.status !== 'active') {
        return res.status(403).json({ error: 'This manager account has been deactivated by Admin. Please contact factory management.' });
      }
      let token = manager.manager_token;
      if (!token) {
        token = 'mgr_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 10);
        await db.prepare('UPDATE managers SET manager_token = ? WHERE id = ?').run(token, manager.id);
        manager.manager_token = token;
      }
      if (deviceId && manager.device_id !== deviceId) {
        await db.prepare('UPDATE managers SET device_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(deviceId, manager.id);
        manager.device_id = deviceId;
      }
    } else {
      const token = 'mgr_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 10);
      const info = await db.prepare(`
        INSERT INTO managers (name, device_id, phone, status, manager_token)
        VALUES (?, ?, ?, 'active', ?)
      `).run(cleanName, deviceId || null, phone || null, token);
      manager = { id: info.lastInsertRowid, name: cleanName, device_id: deviceId, phone, status: 'active', manager_token: token };
    }
    res.json({
      id: manager.id,
      name: manager.name,
      deviceId: manager.device_id,
      phone: manager.phone,
      status: manager.status,
      managerToken: manager.manager_token
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// STAFF MASTER & ATTENDANCE API
// =============================================================
app.get('/api/masters/staff', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM staff';
    const params = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY id ASC';
    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/staff', requireAdmin, async (req, res) => {
  try {
    const { name, phone, designation = 'Worker', department = '', wageType = 'Daily', wageAmount = 0, joiningDate, status = 'active' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Staff name is required.' });
    }
    const info = await db.prepare(`
      INSERT INTO staff (name, phone, designation, department, wage_type, wage_amount, joining_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      phone ? phone.trim() : null,
      designation ? designation.trim() : 'Worker',
      department ? department.trim() : '',
      wageType || 'Daily',
      Number(wageAmount || 0),
      joiningDate || null,
      status || 'active'
    );
    const created = await db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/staff/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Staff member not found.' });

    const { name, phone, designation, department, wageType, wageAmount, joiningDate, status } = req.body;
    await db.prepare(`
      UPDATE staff
      SET name = ?, phone = ?, designation = ?, department = ?, wage_type = ?, wage_amount = ?, joining_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : existing.name,
      phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
      designation !== undefined ? designation.trim() : existing.designation,
      department !== undefined ? department.trim() : (existing.department || ''),
      wageType !== undefined ? wageType : existing.wage_type,
      wageAmount !== undefined ? Number(wageAmount) : existing.wage_amount,
      joiningDate !== undefined ? joiningDate : existing.joining_date,
      status !== undefined ? status : existing.status,
      id
    );
    const updated = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/staff/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const attCount = (await db.prepare('SELECT COUNT(*) as count FROM staff_attendance WHERE staff_id = ?').get(id))?.count || 0;
    if (attCount > 0) {
      await db.prepare("UPDATE staff SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return res.json({ message: 'Staff deactivated as attendance history exists.' });
    }
    await db.prepare('DELETE FROM staff WHERE id = ?').run(id);
    res.json({ message: 'Staff deleted successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Attendance Query
app.get('/api/attendance', async (req, res) => {
  try {
    const { date, dateFrom, dateTo, month, staffId } = req.query;

    if (month) {
      const rows = await db.prepare(`
        SELECT sa.*, s.name AS staff_name, s.name, s.designation, s.department
        FROM staff_attendance sa
        JOIN staff s ON sa.staff_id = s.id
        WHERE sa.date LIKE ? AND s.status = 'active'
        ORDER BY sa.date ASC, s.name ASC
      `).all(`${month}%`);
      return res.json(rows);
    }

    if (date) {
      const rows = await db.prepare(`
        SELECT s.id AS staff_id, s.id, s.name, s.name AS staff_name, s.phone, s.designation, s.department, s.wage_type, s.wage_amount, s.status AS staff_status,
               a.id AS attendance_id, a.date, COALESCE(a.status, 'not_marked') AS status, a.status AS attendance_status, a.overtime_hours, a.remarks, a.marked_by, a.updated_at AS marked_at
        FROM staff s
        LEFT JOIN staff_attendance a ON s.id = a.staff_id AND a.date = ?
        WHERE s.status = 'active'
        ORDER BY s.id ASC
      `).all(date);
      return res.json(rows);
    }

    let query = `
      SELECT a.*, s.name AS staff_name, s.name, s.designation AS staff_designation, s.designation, s.department, s.phone AS staff_phone
      FROM staff_attendance a
      JOIN staff s ON a.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (dateFrom) {
      query += ' AND a.date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND a.date <= ?';
      params.push(dateTo);
    }
    if (staffId) {
      query += ' AND a.staff_id = ?';
      params.push(staffId);
    }
    query += ' ORDER BY a.date DESC, s.name ASC';
    const records = await db.prepare(query).all(...params);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Attendance Save / Upsert
app.post('/api/attendance/bulk', checkManagerModule('attendance', 'Staff Attendance'), async (req, res) => {
  try {
    const { date, records, markedBy, marked_by } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required.' });
    }
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Attendance records array is required.' });
    }

    const finalMarkedBy = (req.role === 'manager' && req.manager)
      ? req.manager.name
      : (markedBy || marked_by || (req.user ? req.user.name : 'Admin'));

    await runTransaction(async () => {
      const upsert = db.prepare(`
        INSERT INTO staff_attendance (staff_id, date, status, overtime_hours, remarks, marked_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(staff_id, date) DO UPDATE SET
          status = excluded.status,
          overtime_hours = excluded.overtime_hours,
          remarks = excluded.remarks,
          marked_by = excluded.marked_by,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const rec of records) {
        const sId = rec.staffId || rec.staff_id;
        if (!sId) continue;
        let st = rec.status || 'present';
        // Normalize status to user specification: 'Full Day', 'Half Day', 'Not Present'
        if (st === 'present' || st === 'Full Day') st = 'Full Day';
        else if (st === 'half_day' || st === 'Half Day') st = 'Half Day';
        else st = 'Not Present';

        await upsert.run(
          sId,
          date,
          st,
          Number(rec.overtimeHours || rec.overtime_hours || 0),
          rec.remarks || '',
          finalMarkedBy
        );
      }
    });

    res.json({ success: true, count: records.length, date, markedBy: finalMarkedBy });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Monthly Attendance Summary
app.get('/api/attendance/summary', async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    const currentMonth = month || new Date().toISOString().substring(0, 7);

    const rows = await db.prepare(`
      SELECT s.id, s.id AS staff_id, s.name, s.name AS staff_name, s.designation, s.department, s.wage_type, s.wage_amount,
             COALESCE(SUM(CASE WHEN a.status = 'Full Day' OR a.status = 'present' THEN 1 ELSE 0 END), 0) AS full_days,
             COALESCE(SUM(CASE WHEN a.status = 'Half Day' OR a.status = 'half_day' THEN 1 ELSE 0 END), 0) AS half_days,
             COALESCE(SUM(CASE WHEN a.status = 'Not Present' OR a.status = 'absent' THEN 1 ELSE 0 END), 0) AS absents,
             COALESCE(SUM(CASE WHEN a.status = 'Not Present' OR a.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent_days,
             COALESCE(SUM(CASE WHEN a.status = 'Full Day' OR a.status = 'present' THEN 1.0 WHEN a.status = 'Half Day' OR a.status = 'half_day' THEN 0.5 ELSE 0 END), 0) AS payable_days,
             COALESCE(SUM(a.overtime_hours), 0) AS total_overtime_hours,
             COUNT(a.id) AS total_marked_days,
             COUNT(a.id) AS marked_days
      FROM staff s
      LEFT JOIN staff_attendance a ON s.id = a.staff_id AND a.date LIKE ?
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY s.name ASC
    `).all(`${currentMonth}%`);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// COMPANY SETTINGS API
// -------------------------------------------------------------
app.get('/api/company/settings', requireAdmin, async (req, res) => {
  try {
    res.json(getCompanySettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/company/settings', requireAdmin, async (req, res) => {
  try {
    const fields = [
      'company_name', 'company_address', 'company_gstin', 'company_state', 'company_state_code',
      'company_phone', 'company_email', 'bank_name', 'bank_account_no', 'bank_ifsc', 'bank_branch'
    ];
    const update = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        await update.run(f, String(req.body[f]));
      }
    }
    res.json({ success: true, settings: getCompanySettings() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// BANK ACCOUNTS MASTER API
// -------------------------------------------------------------
app.get('/api/masters/bank-accounts', async (req, res) => {
  try {
    const isManager = (req.role === 'manager');
    let query = 'SELECT * FROM bank_accounts';
    if (isManager) {
      query += " WHERE status = 'active'";
    }
    query += ' ORDER BY id ASC';
    const rows = await db.prepare(query).all();
    const result = rows.map(b => {
      if (isManager) {
        const acc = String(b.account_number || '');
        const masked = acc.length > 4 ? '••••••••' + acc.slice(-4) : '••••';
        return {
          id: b.id,
          bank_name: b.bank_name,
          account_name: b.account_name,
          account_number: masked,
          ifsc: b.ifsc,
          branch: b.branch,
          status: b.status
        };
      }
      return b;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/bank-accounts', requireAdmin, async (req, res) => {
  try {
    const { bankName, accountName, accountNumber, ifsc, branch, openingBalance = 0, openingBalanceType = 'Dr', status = 'active' } = req.body;
    if (!bankName || !accountName || !accountNumber) {
      return res.status(400).json({ error: 'Bank Name, Account Name, and Account Number are required.' });
    }
    const info = await db.prepare(`
      INSERT INTO bank_accounts (bank_name, account_name, account_number, ifsc, branch, opening_balance, opening_balance_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bankName.trim(), accountName.trim(), accountNumber.trim(), ifsc ? ifsc.trim() : null, branch ? branch.trim() : null, Number(openingBalance) || 0, openingBalanceType || 'Dr', status || 'active');

    const newId = info.lastInsertRowid;
    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'CREATE', ?, 'Admin')
    `).run('BANK_ACCOUNT', String(newId), JSON.stringify({ bankName, accountName, accountNumber: '••••' + String(accountNumber).slice(-4), openingBalance }));

    // If opening balance > 0, also create/sync opening_balances record for active FY
    const opBal = Number(openingBalance);
    if (opBal > 0) {
      const activeFy = await getActiveFinancialYear();
      const fyRow = await db.prepare('SELECT start_date FROM financial_years WHERE name = ?').get(activeFy);
      const opDate = fyRow ? fyRow.start_date : '2026-04-01';
      await db.prepare(`
        INSERT INTO opening_balances (financial_year, opening_date, entity_type, entity_id, amount, balance_type, remarks, created_by)
        VALUES (?, ?, 'BANK', ?, ?, ?, 'Bank Master Initial Opening Balance', 'Admin')
        ON CONFLICT (financial_year, entity_type, entity_id) DO UPDATE
        SET amount = EXCLUDED.amount, balance_type = EXCLUDED.balance_type, updated_at = CURRENT_TIMESTAMP
      `).run(activeFy, opDate, newId, opBal, openingBalanceType || 'Dr');
    }

    res.status(201).json({ id: newId, bank_name: bankName, account_name: accountName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/bank-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const bank = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(req.params.id);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });
    const { bankName, accountName, accountNumber, ifsc, branch, openingBalance, openingBalanceType, status } = req.body;
    await db.prepare(`
      UPDATE bank_accounts
      SET bank_name = COALESCE(?, bank_name),
          account_name = COALESCE(?, account_name),
          account_number = COALESCE(?, account_number),
          ifsc = COALESCE(?, ifsc),
          branch = COALESCE(?, branch),
          opening_balance = COALESCE(?, opening_balance),
          opening_balance_type = COALESCE(?, opening_balance_type),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      bankName ?? null,
      accountName ?? null,
      accountNumber ?? null,
      ifsc ?? null,
      branch ?? null,
      openingBalance !== undefined ? Number(openingBalance) : null,
      openingBalanceType ?? null,
      status ?? null,
      bank.id
    );

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
      VALUES (?, ?, 'EDIT', ?, ?, 'Admin')
    `).run('BANK_ACCOUNT', String(bank.id), JSON.stringify(bank), JSON.stringify(req.body));

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/bank-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const bank = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });

    const payCount = (await db.prepare('SELECT COUNT(*) as count FROM payments WHERE bank_account_id = ?').get(id))?.count || 0;
    const tfCount = (await db.prepare('SELECT COUNT(*) as count FROM bank_transfers WHERE from_bank_id = ? OR to_bank_id = ?').get(id, id))?.count || 0;
    if (payCount > 0 || tfCount > 0) {
      return res.status(400).json({ error: 'Cannot delete bank account with associated payments or transfers. Deactivate it instead.' });
    }

    await db.prepare("DELETE FROM opening_balances WHERE entity_type = 'BANK' AND entity_id = ?").run(id);
    await db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(id);

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
      VALUES (?, ?, 'DELETE', ?, 'Admin')
    `).run('BANK_ACCOUNT', String(id), JSON.stringify(bank));

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// EXPENSE & INCOME HEADS MASTER
// =============================================================
app.get('/api/masters/expense-heads', async (req, res) => {
  try {
    const { type, status } = req.query;
    let query = 'SELECT * FROM expense_heads WHERE 1=1';
    const params = [];
    if (type) {
      query += ' AND UPPER(type) = ?';
      params.push(type.toUpperCase());
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY type ASC, name ASC';
    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/masters/expense-heads', checkManagerModule('masters', 'Masters'), async (req, res) => {
  try {
    const { name, type = 'EXPENSE', category = 'Direct Expense', description = '', status = 'active' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Expense/Income Head Name is required.' });
    }
    const cleanName = name.trim();
    const cleanType = (type || 'EXPENSE').toUpperCase();
    if (!['EXPENSE', 'INCOME'].includes(cleanType)) {
      return res.status(400).json({ error: 'Type must be EXPENSE or INCOME.' });
    }
    const existing = await db.prepare('SELECT id FROM expense_heads WHERE LOWER(name) = LOWER(?) AND type = ?').get(cleanName, cleanType);
    if (existing) {
      return res.status(400).json({ error: `Head "${cleanName}" already exists for type ${cleanType}.` });
    }

    const prefix = cleanType === 'INCOME' ? 'INC' : 'EXP';
    const code = await getNextCode(prefix, 'expense_heads', 'code');
    const finalCreator = (req.role === 'manager' && req.manager) ? req.manager.name : 'Admin';

    const info = await db.prepare(`
      INSERT INTO expense_heads (code, name, type, category, status, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, cleanName, cleanType, category || (cleanType === 'INCOME' ? 'Side Income' : 'Direct Expense'), status || 'active', description || null);

    const newId = info.lastInsertRowid;
    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'CREATE', ?, ?)
    `).run('EXPENSE_HEAD', code, JSON.stringify({ code, name: cleanName, type: cleanType, category }), finalCreator);

    res.status(201).json({
      id: newId,
      code,
      name: cleanName,
      type: cleanType,
      category,
      status: status || 'active',
      description
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/masters/expense-heads/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const head = await db.prepare('SELECT * FROM expense_heads WHERE id = ?').get(id);
    if (!head) return res.status(404).json({ error: 'Expense/Income head not found.' });

    const { name, type, category, description, status } = req.body;
    await db.prepare(`
      UPDATE expense_heads
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          category = COALESCE(?, category),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      type ? type.toUpperCase() : null,
      category ?? null,
      description !== undefined ? description : null,
      status ?? null,
      id
    );

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
      VALUES (?, ?, 'EDIT', ?, ?, 'Admin')
    `).run('EXPENSE_HEAD', head.code, JSON.stringify(head), JSON.stringify(req.body));

    res.json({ success: true, id: Number(id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/masters/expense-heads/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const head = await db.prepare('SELECT * FROM expense_heads WHERE id = ?').get(id);
    if (!head) return res.status(404).json({ error: 'Expense/Income head not found.' });

    const payCount = (await db.prepare("SELECT COUNT(*) as count FROM payments WHERE party_type IN ('EXPENSE', 'INCOME') AND party_id = ?").get(id))?.count || 0;
    if (payCount > 0) {
      return res.status(400).json({
        error: `Cannot delete "${head.name}" because it has ${payCount} recorded payment/receipt transaction(s). Deactivate it instead.`
      });
    }

    await db.prepare('DELETE FROM expense_heads WHERE id = ?').run(id);
    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
      VALUES (?, ?, 'DELETE', ?, 'Admin')
    `).run('EXPENSE_HEAD', head.code, JSON.stringify(head));

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. TRANSACTIONS API
// -------------------------------------------------------------

// =============================================================
// PRODUCTION ORDERS (Manufacturing Orders - Does NOT affect stock)
// =============================================================
app.get('/api/transactions/production-orders', async (req, res) => {
  try {
    const { status, customerId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT po.*, c.name AS customer_name, c.gst_number AS customer_gstin,
             fp.product_name, fp.product_code
      FROM production_orders po
      JOIN customers c ON po.customer_id = c.id
      JOIN finished_products fp ON po.finished_product_id = fp.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND po.status = ?'; params.push(status); }
    if (customerId) { query += ' AND po.customer_id = ?'; params.push(customerId); }
    if (dateFrom) { query += ' AND po.order_date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND po.order_date <= ?'; params.push(dateTo); }
    query += ' ORDER BY po.id DESC';
    res.json(await db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/production-orders', checkManagerModule('orders', 'Production Orders'), async (req, res) => {
  try {
    const {
      orderDate, customerId, customerOrderNo, finishedProductId,
      gsm, size, requiredQuantity, unit = 'KG', deliveryDate, remarks
    } = req.body;
    const reqQty = Number(requiredQuantity);
    if (!orderDate || !customerId || !finishedProductId || reqQty <= 0) {
      return res.status(400).json({ error: 'Valid Order Date, Customer, Finished Product, and Required Quantity (>0) are required.' });
    }
    const orderNo = await getNextCode('PO', 'production_orders', 'order_no');
    const finalCreator = (req.role === 'manager' && req.manager) ? req.manager.name : 'Admin';
    const info = await db.prepare(`
      INSERT INTO production_orders (
        order_no, order_date, customer_id, customer_order_no, finished_product_id,
        gsm, size, required_quantity, unit, delivery_date, remarks, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `).run(
      orderNo, orderDate, customerId, customerOrderNo || null, finishedProductId,
      gsm ? Number(gsm) : null, size || null, reqQty, unit || 'KG',
      deliveryDate || null, remarks || null, finalCreator
    );

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('PRODUCTION_ORDER', orderNo, 'CREATE', JSON.stringify({ orderNo, customerId, finishedProductId, reqQty, unit }), finalCreator);

    res.status(201).json({ id: info.lastInsertRowid, order_no: orderNo, status: 'Pending' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/transactions/production-orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'In Production', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Pending, In Production, Completed, or Cancelled.' });
    }
    const order = await db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Production order not found' });
    await db.prepare('UPDATE production_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ success: true, status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/transactions/production-orders/:id', requireAdmin, async (req, res) => {
  try {
    const { orderDate, customerId, customerOrderNo, finishedProductId, gsm, size, requiredQuantity, unit, deliveryDate, remarks, status } = req.body;
    const order = await db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Production order not found' });

    await db.prepare(`
      UPDATE production_orders
      SET order_date = COALESCE(?, order_date),
          customer_id = COALESCE(?, customer_id),
          customer_order_no = COALESCE(?, customer_order_no),
          finished_product_id = COALESCE(?, finished_product_id),
          gsm = COALESCE(?, gsm),
          size = COALESCE(?, size),
          required_quantity = COALESCE(?, required_quantity),
          unit = COALESCE(?, unit),
          delivery_date = COALESCE(?, delivery_date),
          remarks = COALESCE(?, remarks),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      orderDate ?? null, customerId ? Number(customerId) : null, customerOrderNo ?? null,
      finishedProductId ? Number(finishedProductId) : null, gsm ? Number(gsm) : null,
      size ?? null, requiredQuantity ? Number(requiredQuantity) : null, unit ?? null,
      deliveryDate ?? null, remarks ?? null, status ?? null, req.params.id
    );

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/production-orders/:id', requireAdmin, async (req, res) => {
  try {
    const order = await db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Production order not found' });
    const countCB = (await db.prepare('SELECT COUNT(*) as c FROM consumption_batches WHERE production_order_id = ?').get(order.id))?.c || 0;
    const countPB = (await db.prepare('SELECT COUNT(*) as c FROM production_batches WHERE production_order_id = ?').get(order.id))?.c || 0;
    if (countCB > 0 || countPB > 0) {
      return res.status(400).json({ error: 'Cannot delete production order with linked consumption or production history. Cancel it instead.' });
    }
    await db.prepare('DELETE FROM production_orders WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// CONSUMPTION / MATERIAL ISSUE BATCHES (Separate Transaction)
// =============================================================
app.get('/api/transactions/consumption-batches', async (req, res) => {
  try {
    const { dateFrom, dateTo, machineId, shiftId, status, managerName, productionReady } = req.query;
    let query = `
      SELECT cb.*, m.name AS machine_name, m.machine_code, s.name AS shift_name,
             po.order_no AS production_order_no,
             pb.id AS linked_production_id, pb.batch_code AS linked_production_batch_code
      FROM consumption_batches cb
      LEFT JOIN machines m ON cb.machine_id = m.id
      LEFT JOIN shifts s ON cb.shift_id = s.id
      LEFT JOIN production_orders po ON cb.production_order_id = po.id
      LEFT JOIN production_batches pb ON pb.consumption_batch_id = cb.id AND pb.is_voided = 0
      WHERE 1=1
    `;
    const params = [];
    if (dateFrom) { query += ' AND cb.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND cb.date <= ?'; params.push(dateTo); }
    if (machineId) { query += ' AND cb.machine_id = ?'; params.push(machineId); }
    if (shiftId) { query += ' AND cb.shift_id = ?'; params.push(shiftId); }
    if (status) { query += ' AND cb.status = ?'; params.push(status); }
    if (managerName) { query += ' AND cb.manager_name = ?'; params.push(managerName); }
    if (productionReady === 'true') {
      query += " AND cb.status = 'Issued' AND pb.id IS NULL";
    }
    query += ' ORDER BY cb.id DESC';
    const batches = await db.prepare(query).all(...params);

    const getItems = db.prepare(`
      SELECT cbi.*, rm.name AS raw_material_name, rm.code AS raw_material_code, rm.unit AS default_unit
      FROM consumption_batch_items cbi
      JOIN raw_materials rm ON cbi.raw_material_id = rm.id
      WHERE cbi.consumption_batch_id = ?
    `);

    const result = await Promise.all(batches.map(async b => {
      const items = await getItems.all(b.id);
      const totalIssuedKg = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      return {
        ...b,
        batch_code: b.batch_no || b.batch_code,
        total_issued_kg: totalIssuedKg,
        production_status: (b.linked_production_id || b.status === 'Completed') ? 'Completed' : (b.status === 'Issued' ? 'Ready for Production' : b.status),
        items
      };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single Material Issue / Consumption Batch by ID
app.get('/api/transactions/consumption-batches/:id', async (req, res) => {
  try {
    const batch = await db.prepare(`
      SELECT cb.*, m.name AS machine_name, m.machine_code, s.name AS shift_name,
             po.order_no AS production_order_no
      FROM consumption_batches cb
      LEFT JOIN machines m ON cb.machine_id = m.id
      LEFT JOIN shifts s ON cb.shift_id = s.id
      LEFT JOIN production_orders po ON cb.production_order_id = po.id
      WHERE cb.id = ?
    `).get(req.params.id);

    if (!batch) {
      return res.status(404).json({ error: 'Material Issue Batch not found' });
    }

    const items = await db.prepare(`
      SELECT cbi.*, rm.name AS raw_material_name, rm.code AS raw_material_code, rm.unit AS default_unit
      FROM consumption_batch_items cbi
      JOIN raw_materials rm ON cbi.raw_material_id = rm.id
      WHERE cbi.consumption_batch_id = ?
    `).all(batch.id);

    const totalIssuedKg = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

    res.json({
      ...batch,
      batch_code: batch.batch_no,
      total_issued_kg: totalIssuedKg,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/consumption-batches', checkManagerModule('consumptions', 'Material Issues (RM)'), async (req, res) => {
  try {
    const {
      date, productionOrderId, machineId, shiftId, remarks = '',
      status = 'Issued', // 'Draft' or 'Issued'
      items,
      rawMaterialId, quantityKg
    } = req.body;

    const finalItems = Array.isArray(items) && items.length > 0
      ? items
      : (rawMaterialId && quantityKg ? [{ rawMaterialId, quantity: quantityKg, unit: 'KG' }] : []);

    if (!date || finalItems.length === 0) {
      return res.status(400).json({ error: 'Date and at least one material issue line are required.' });
    }

    if (productionOrderId) {
      const pOrder = await db.prepare('SELECT status FROM production_orders WHERE id = ?').get(productionOrderId);
      if (pOrder && pOrder.status === 'Cancelled') {
        return res.status(400).json({ error: 'Cannot issue material against a cancelled production order.' });
      }
    }

    // If status is 'Issued', validate stock availability for EVERY raw material line
    if (status === 'Issued') {
      for (const item of finalItems) {
        const q = Number(item.quantity);
        if (isNaN(q) || q <= 0) {
          return res.status(400).json({ error: 'Each material issue line must have a valid quantity (>0).' });
        }
        const rm = await db.prepare('SELECT name, unit FROM raw_materials WHERE id = ?').get(item.rawMaterialId);
        const avail = await getRawMaterialStock(item.rawMaterialId);
        if (q > avail) {
          return res.status(400).json({
            error: `Insufficient stock for raw material "${rm ? rm.name : item.rawMaterialId}". Available: ${avail.toLocaleString()} ${item.unit || (rm ? rm.unit : 'KG')}, Required: ${q.toLocaleString()} ${item.unit || (rm ? rm.unit : 'KG')}.`,
            available: avail,
            required: q
          });
        }
      }
    }

    const finalManagerName = (req.role === 'manager' && req.manager) ? req.manager.name : (req.body.managerName || 'Admin');
    const finalManagerId = (req.role === 'manager' && req.manager) ? req.manager.id : (req.body.managerId || null);
    const finalDeviceId = (req.role === 'manager' && req.manager) ? (req.manager.device_id || req.body.deviceId || '') : (req.body.deviceId || '');

    const result = await runTransaction(async () => {
      const batchNo = await getNextCode('CB', 'consumption_batches', 'batch_no');
      const info = await db.prepare(`
        INSERT INTO consumption_batches (
          batch_no, date, production_order_id, machine_id, shift_id,
          manager_id, manager_name, device_id, status, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batchNo, date, productionOrderId || null, machineId || null, shiftId || null,
        finalManagerId, finalManagerName, finalDeviceId, status, remarks
      );
      const batchId = info.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO consumption_batch_items (
          consumption_batch_id, raw_material_id, quantity, unit, batch_lot, remarks
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMov = db.prepare(`
        INSERT INTO raw_material_movements (
          movement_type, reference_type, reference_id, raw_material_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of finalItems) {
        const q = Number(item.quantity);
        const u = item.unit || 'KG';
        await insertItem.run(batchId, item.rawMaterialId, q, u, item.batchLot || null, item.remarks || null);

        // Only deduct stock if status is 'Issued'
        if (status === 'Issued') {
          const currentStock = await getRawMaterialStock(item.rawMaterialId);
          const newBal = Number((currentStock - q).toFixed(2));
          await insertMov.run(
            'CONSUMPTION', 'CONSUMPTION_BATCH', batchNo, item.rawMaterialId, -q,
            u, newBal, finalManagerName, `Issued in batch ${batchNo}`
          );
        }
      }

      // If tied to a production order and was pending, advance to In Production
      if (productionOrderId && status === 'Issued') {
        await db.prepare("UPDATE production_orders SET status = 'In Production' WHERE id = ? AND status = 'Pending'").run(productionOrderId);
      }

      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('CONSUMPTION_BATCH', batchNo, 'CREATE', JSON.stringify({ status, itemsCount: finalItems.length }), finalManagerName, finalDeviceId);

      const savedItems = await db.prepare(`
        SELECT cbi.*, rm.name as raw_material_name
        FROM consumption_batch_items cbi
        JOIN raw_materials rm ON cbi.raw_material_id = rm.id
        WHERE cbi.consumption_batch_id = ?
      `).all(batchId);

      return { id: batchId, batch_no: batchNo, status, itemsCount: finalItems.length, items: savedItems };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/transactions/consumption-batches/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Draft', 'Issued', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Draft, Issued, or Cancelled' });
    }
    const batch = await db.prepare('SELECT * FROM consumption_batches WHERE id = ?').get(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status === status) return res.json({ success: true, status });

    const items = await db.prepare('SELECT * FROM consumption_batch_items WHERE consumption_batch_id = ?').all(batch.id);

    await runTransaction(async () => {
      // Draft -> Issued: deduct stock
      if (batch.status === 'Draft' && status === 'Issued') {
        for (const it of items) {
          const avail = await getRawMaterialStock(it.raw_material_id);
          if (it.quantity > avail) {
            throw new Error(`Insufficient stock for material ID ${it.raw_material_id} (Available: ${avail}, Required: ${it.quantity})`);
          }
          const newBal = Number((avail - it.quantity).toFixed(2));
          await db.prepare(`
            INSERT INTO raw_material_movements (
              movement_type, reference_type, reference_id, raw_material_id, quantity_change,
              unit, balance_after, manager_name, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run('CONSUMPTION', 'CONSUMPTION_BATCH', batch.batch_no, it.raw_material_id, -it.quantity, it.unit, newBal, 'Admin', `Confirmed issue ${batch.batch_no}`);
        }
      } else if (batch.status === 'Issued' && status === 'Cancelled') {
        // Issued -> Cancelled: restore stock
        for (const it of items) {
          const avail = await getRawMaterialStock(it.raw_material_id);
          const newBal = Number((avail + it.quantity).toFixed(2));
          await db.prepare(`
            INSERT INTO raw_material_movements (
              movement_type, reference_type, reference_id, raw_material_id, quantity_change,
              unit, balance_after, manager_name, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run('ADJUSTMENT', 'CONSUMPTION_VOID', batch.batch_no, it.raw_material_id, it.quantity, it.unit, newBal, 'Admin', `Restored from cancelled issue ${batch.batch_no}`);
        }
      }

      await db.prepare('UPDATE consumption_batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('CONSUMPTION_BATCH', batch.batch_no, 'STATUS_UPDATE', JSON.stringify({ status: batch.status }), JSON.stringify({ status }), 'Admin');
    });

    res.json({ success: true, status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/consumption-batches/:id', requireAdmin, async (req, res) => {
  try {
    const batch = await db.prepare('SELECT * FROM consumption_batches WHERE id = ?').get(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Consumption batch not found' });

    const linkedProd = (await db.prepare('SELECT COUNT(*) as c FROM production_batches WHERE consumption_batch_id = ? AND is_voided = 0').get(batch.id))?.c || 0;
    if (linkedProd > 0) {
      return res.status(400).json({ error: 'Cannot delete consumption batch: active production batch is linked to it. Please void/delete the production batch first.' });
    }

    const items = await db.prepare('SELECT * FROM consumption_batch_items WHERE consumption_batch_id = ?').all(batch.id);

    await runTransaction(async () => {
      // If batch was Issued (and not Cancelled), restore raw material stock
      if (batch.status === 'Issued') {
        for (const it of items) {
          const curStock = await getRawMaterialStock(it.raw_material_id);
          const newBal = Number((curStock + it.quantity).toFixed(2));
          await db.prepare(`
            INSERT INTO raw_material_movements (
              movement_type, reference_type, reference_id, raw_material_id, quantity_change,
              unit, balance_after, manager_name, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run('ADJUSTMENT', 'CONSUMPTION_DELETE', batch.batch_no, it.raw_material_id, it.quantity, it.unit, newBal, 'Admin', `Restored from deleted consumption batch ${batch.batch_no}`);
        }
      }

      await db.prepare('DELETE FROM consumption_batch_items WHERE consumption_batch_id = ?').run(batch.id);
      await db.prepare('DELETE FROM consumption_batches WHERE id = ?').run(batch.id);

      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
        VALUES (?, ?, 'DELETE', ?, 'Admin')
      `).run('CONSUMPTION_BATCH', batch.batch_no, JSON.stringify({ batch, items }));
    });

    res.json({ success: true, message: 'Consumption batch deleted and stock restored.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// RAW MATERIAL PURCHASE (Multi-Item, GST/Non-GST, Stock & Ledger)
// =============================================================
// GET: Managers can read purchases (to view their own entries)
app.get('/api/transactions/purchases', async (req, res) => {
  try {
    const { dateFrom, dateTo, supplierId, rawMaterialId, managerName, includeVoided } = req.query;
    let query = `
      SELECT p.*, s.name AS supplier_name, s.gst_number AS supplier_gstin, s.state AS supplier_state,
             rm.name AS raw_material_name, rm.code AS raw_material_code, rm.hsn_code AS raw_material_hsn
      FROM raw_material_purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN raw_materials rm ON p.raw_material_id = rm.id
      WHERE (p.is_voided = 0 OR p.is_voided IS NULL)
    `;
    if (includeVoided === 'true') {
      query = query.replace('WHERE (p.is_voided = 0 OR p.is_voided IS NULL)', 'WHERE 1=1');
    }
    const params = [];
    if (dateFrom) { query += ' AND p.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND p.date <= ?'; params.push(dateTo); }
    if (supplierId) { query += ' AND p.supplier_id = ?'; params.push(supplierId); }
    if (rawMaterialId) { query += ' AND p.raw_material_id = ?'; params.push(rawMaterialId); }
    if (managerName) { query += ' AND p.manager_name = ?'; params.push(managerName); }

    query += ' ORDER BY p.id DESC';
    const rows = await db.prepare(query).all(...params);

    const getItems = db.prepare(`
      SELECT pi.*, rm.name AS raw_material_name, rm.code AS raw_material_code
      FROM purchase_items pi
      JOIN raw_materials rm ON pi.raw_material_id = rm.id
      WHERE pi.purchase_id = ?
    `);

    const result = await Promise.all(rows.map(async r => {
      let parsedEl = [];
      try {
        parsedEl = r.el_charges ? (typeof r.el_charges === 'string' ? JSON.parse(r.el_charges) : r.el_charges) : [];
      } catch (e) {
        parsedEl = [];
      }
      return {
        ...r,
        el_charges: parsedEl,
        items: await getItems.all(r.id)
      };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/purchases', checkManagerModule('purchases', 'Raw Material Purchases'), async (req, res) => {
  try {
    const {
      date,
      supplierId,
      purchaseType = 'GST', // 'GST' or 'NON_GST'
      paymentMode = 'Credit', // 'Credit', 'Cash', 'Bank'
      invoiceNumber = '',
      discountAmount = 0,
      otherCharges = 0,
      roundOff = 0,
      elCharges = [],
      remarks = '',
      managerName = 'Admin',
      managerId = null,
      deviceId = '',
      isInterState: reqIsInterState,
      items, // Array of { rawMaterialId, quantity, unit, rate, discount, hsnCode, gstPercent }
      rawMaterialId, quantityKg, ratePerKg, gstPercent // legacy fallback
    } = req.body;

    const supp = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supp) return res.status(400).json({ error: 'Valid Supplier is required.' });

    const finalItems = Array.isArray(items) && items.length > 0
      ? items
      : (rawMaterialId && quantityKg && ratePerKg ? [{
          rawMaterialId,
          quantity: quantityKg,
          unit: 'KG',
          rate: ratePerKg,
          discount: 0,
          gstPercent
        }] : []);

    if (!date || !supplierId || finalItems.length === 0) {
      return res.status(400).json({ error: 'Valid Date, Supplier, and at least one item line are required.' });
    }

    const partyState = supp.state || 'Gujarat';
    const partyGstin = supp.gst_number || '';
    const isGST = (purchaseType === 'GST');
    const isInterState = reqIsInterState !== undefined && reqIsInterState !== null ? Boolean(reqIsInterState) : null;

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalLinesAmount = 0;

    const processedLines = [];
    for (const it of finalItems) {
      const q = Number(it.quantity || it.quantityKg);
      const r = Number(it.rate || it.ratePerKg);
      const disc = Number(it.discount || 0);
      if (isNaN(q) || q <= 0 || isNaN(r) || r <= 0) {
        return res.status(400).json({ error: 'Each purchase line must have quantity > 0 and rate > 0.' });
      }

      const rm = await db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(it.rawMaterialId);
      if (!rm) {
        return res.status(400).json({ error: `Raw material ID ${it.rawMaterialId} not found.` });
      }

      const lineTaxable = Number(((q * r) - disc).toFixed(2));
      const lineGstPct = isGST ? Number(it.gstPercent !== undefined ? it.gstPercent : (rm.gst_percent || 18)) : 0;
      const gstData = isGST ? calculateGstBreakdown({ taxableAmount: lineTaxable, gstPercent: lineGstPct, partyState, partyGstin, isInterState }) : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0, grandTotal: lineTaxable };

      totalTaxable += lineTaxable;
      totalCgst += gstData.cgstAmount;
      totalSgst += gstData.sgstAmount;
      totalIgst += gstData.igstAmount;
      totalLinesAmount += gstData.grandTotal;

      processedLines.push({
        rawMaterialId: it.rawMaterialId,
        quantity: q,
        unit: it.unit || rm.unit || 'KG',
        rate: r,
        discount: disc,
        hsnCode: it.hsnCode || rm.hsn_code || '3901',
        gstPercent: lineGstPct,
        taxableAmount: lineTaxable,
        gstAmount: gstData.totalGst,
        cgstAmount: gstData.cgstAmount,
        sgstAmount: gstData.sgstAmount,
        igstAmount: gstData.igstAmount,
        totalAmount: gstData.grandTotal
      });
    }

    const billDiscount = Number(discountAmount || 0);
    const billOther = Number(otherCharges || 0);
    const billRound = Number(roundOff || 0);

    const validElCharges = Array.isArray(elCharges)
      ? elCharges.filter(c => c && c.label && Number(c.amount) > 0).map(c => {
          const amt = Number(Number(c.amount).toFixed(2));
          const chargeGstPct = isGST ? Number(c.gstPercent !== undefined ? c.gstPercent : 18) : 0;
          const chargeGstData = isGST
            ? calculateGstBreakdown({ taxableAmount: amt, gstPercent: chargeGstPct, partyState, partyGstin, isInterState })
            : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0, grandTotal: amt };
          return {
            id: c.id || Date.now(),
            label: String(c.label).trim(),
            amount: amt,
            gstPercent: chargeGstPct,
            taxableAmount: amt,
            gstAmount: chargeGstData.totalGst,
            cgstAmount: chargeGstData.cgstAmount,
            sgstAmount: chargeGstData.sgstAmount,
            igstAmount: chargeGstData.igstAmount,
            totalAmount: chargeGstData.grandTotal
          };
        })
      : [];

    for (const c of validElCharges) {
      totalTaxable = Number((totalTaxable + c.taxableAmount).toFixed(2));
      totalCgst = Number((totalCgst + c.cgstAmount).toFixed(2));
      totalSgst = Number((totalSgst + c.sgstAmount).toFixed(2));
      totalIgst = Number((totalIgst + c.igstAmount).toFixed(2));
    }

    const grandTotal = Number((totalTaxable + totalCgst + totalSgst + totalIgst + billOther - billDiscount + billRound).toFixed(2));

    const finalManagerName = (req.role === 'manager' && req.manager) ? req.manager.name : (managerName || 'Admin');
    const finalManagerId = (req.role === 'manager' && req.manager) ? req.manager.id : (managerId || null);
    const finalDeviceId = (req.role === 'manager' && req.manager) ? (req.manager.device_id || deviceId || '') : (deviceId || '');

    const result = await runTransaction(async () => {
      const code = await getNextCode('PUR', 'raw_material_purchases', 'purchase_code');
      const firstItem = processedLines[0];

      // 1. Insert header
      const info = await db.prepare(`
        INSERT INTO raw_material_purchases (
          purchase_code, date, supplier_id, raw_material_id, quantity_kg, rate_per_kg,
          taxable_amount, gst_percent, cgst_amount, sgst_amount, igst_amount, total_amount,
          purchase_type, discount_amount, other_charges, round_off, payment_mode,
          invoice_number, remarks, manager_id, manager_name, device_id, el_charges
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        code, date, supplierId, firstItem.rawMaterialId, firstItem.quantity, firstItem.rate,
        totalTaxable, firstItem.gstPercent, totalCgst, totalSgst, totalIgst, grandTotal,
        purchaseType, billDiscount, billOther, billRound, paymentMode,
        invoiceNumber, remarks, finalManagerId, finalManagerName, finalDeviceId,
        JSON.stringify(validElCharges)
      );
      const purchaseId = info.lastInsertRowid;

      // 2. Insert items & stock IN
      const insertItem = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, raw_material_id, quantity, unit, rate, discount, hsn_code,
          gst_percent, taxable_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMov = db.prepare(`
        INSERT INTO raw_material_movements (
          movement_type, reference_type, reference_id, raw_material_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pl of processedLines) {
        await insertItem.run(
          purchaseId, pl.rawMaterialId, pl.quantity, pl.unit, pl.rate, pl.discount,
          pl.hsnCode, pl.gstPercent, pl.taxableAmount, pl.gstAmount, pl.cgstAmount, pl.sgstAmount, pl.igstAmount, pl.totalAmount
        );

        const currentStock = await getRawMaterialStock(pl.rawMaterialId);
        const newBalance = Number((currentStock + pl.quantity).toFixed(2));
        await insertMov.run(
          'PURCHASE', 'PURCHASE', code, pl.rawMaterialId, pl.quantity,
          pl.unit, newBalance, finalManagerName, `Purchase invoice ${code}`
        );
      }

      // 3. Audit Log
      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('PURCHASE', code, 'CREATE', JSON.stringify({ itemsCount: processedLines.length, grandTotal, supplierId, paymentMode }), finalManagerName, finalDeviceId);

      return {
        id: purchaseId,
        purchase_code: code,
        date,
        quantity_kg: firstItem.quantity,
        rate_per_kg: firstItem.rate,
        taxable_amount: totalTaxable,
        gst_percent: firstItem.gstPercent,
        cgst_amount: totalCgst,
        sgst_amount: totalSgst,
        igst_amount: totalIgst,
        total_amount: grandTotal,
        manager_name: finalManagerName,
        current_stock: await getRawMaterialStock(firstItem.rawMaterialId),
        el_charges: validElCharges,
        items: processedLines
      };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating purchase:', err);
    res.status(400).json({ error: err.message });
  }
});

// GET: Managers can read a single purchase (e.g., to view challan)
app.get('/api/transactions/purchases/:id', async (req, res) => {
  try {
    const pur = await db.prepare(`
      SELECT p.*, s.name AS supplier_name, s.gst_number AS supplier_gstin, s.state AS supplier_state
      FROM raw_material_purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!pur) return res.status(404).json({ error: 'Purchase record not found' });

    const items = await db.prepare(`
      SELECT pi.*, rm.name AS raw_material_name, rm.code AS raw_material_code, rm.unit AS master_unit
      FROM purchase_items pi
      JOIN raw_materials rm ON pi.raw_material_id = rm.id
      WHERE pi.purchase_id = ?
    `).all(pur.id);

    let parsedEl = [];
    try {
      parsedEl = pur.el_charges ? (typeof pur.el_charges === 'string' ? JSON.parse(pur.el_charges) : pur.el_charges) : [];
    } catch (e) {
      parsedEl = [];
    }

    res.json({ ...pur, el_charges: parsedEl, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/transactions/purchases/:id', requireAdmin, async (req, res) => {
  try {
    const pur = await db.prepare('SELECT * FROM raw_material_purchases WHERE id = ?').get(req.params.id);
    if (!pur) return res.status(404).json({ error: 'Purchase record not found' });
    if (pur.is_voided) return res.status(400).json({ error: 'Cannot edit a voided purchase.' });

    const {
      date,
      supplierId,
      purchaseType = pur.purchase_type || 'GST',
      paymentMode = pur.payment_mode || 'Credit',
      invoiceNumber = pur.invoice_number || '',
      discountAmount = 0,
      otherCharges = 0,
      roundOff = 0,
      elCharges = [],
      remarks = '',
      isInterState: reqIsInterState,
      items
    } = req.body;

    const supp = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId || pur.supplier_id);
    if (!supp) return res.status(400).json({ error: 'Valid Supplier is required.' });

    const finalItems = Array.isArray(items) && items.length > 0 ? items : [];
    if (!date || finalItems.length === 0) {
      return res.status(400).json({ error: 'Valid Date and at least one item line are required.' });
    }

    const oldItems = await db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(pur.id);
    const oldItemsToReverse = oldItems.length > 0 ? oldItems : [{ raw_material_id: pur.raw_material_id, quantity: pur.quantity_kg, unit: 'KG' }];

    // Verify stock availability to reverse old items
    for (const it of oldItemsToReverse) {
      const avail = await getRawMaterialStock(it.raw_material_id);
      if (avail < it.quantity) {
        return res.status(400).json({
          error: `Cannot edit purchase: Material ID ${it.raw_material_id} has already been consumed in production (Available: ${avail}, Original Purchase: ${it.quantity}).`
        });
      }
    }

    const partyState = supp.state || 'Gujarat';
    const partyGstin = supp.gst_number || '';
    const isGST = (purchaseType === 'GST');
    const isInterState = reqIsInterState !== undefined && reqIsInterState !== null ? Boolean(reqIsInterState) : null;

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalLinesAmount = 0;

    const processedLines = [];
    for (const it of finalItems) {
      const q = Number(it.quantity || it.quantityKg);
      const r = Number(it.rate || it.ratePerKg);
      const disc = Number(it.discount || 0);
      if (isNaN(q) || q <= 0 || isNaN(r) || r <= 0) {
        return res.status(400).json({ error: 'Each purchase line must have quantity > 0 and rate > 0.' });
      }

      const rm = await db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(it.rawMaterialId);
      if (!rm) {
        return res.status(400).json({ error: `Raw material ID ${it.rawMaterialId} not found.` });
      }

      const lineTaxable = Number(((q * r) - disc).toFixed(2));
      const lineGstPct = isGST ? Number(it.gstPercent !== undefined ? it.gstPercent : (rm.gst_percent || 18)) : 0;
      const gstData = isGST ? calculateGstBreakdown({ taxableAmount: lineTaxable, gstPercent: lineGstPct, partyState, partyGstin, isInterState }) : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0, grandTotal: lineTaxable };

      totalTaxable += lineTaxable;
      totalCgst += gstData.cgstAmount;
      totalSgst += gstData.sgstAmount;
      totalIgst += gstData.igstAmount;
      totalLinesAmount += gstData.grandTotal;

      processedLines.push({
        rawMaterialId: it.rawMaterialId,
        quantity: q,
        unit: it.unit || rm.unit || 'KG',
        rate: r,
        discount: disc,
        hsnCode: it.hsnCode || rm.hsn_code || '3901',
        gstPercent: lineGstPct,
        taxableAmount: lineTaxable,
        gstAmount: gstData.totalGst,
        cgstAmount: gstData.cgstAmount,
        sgstAmount: gstData.sgstAmount,
        igstAmount: gstData.igstAmount,
        totalAmount: gstData.grandTotal
      });
    }

    const billDiscount = Number(discountAmount || 0);
    const billOther = Number(otherCharges || 0);
    const billRound = Number(roundOff || 0);

    const validElCharges = Array.isArray(elCharges)
      ? elCharges.filter(c => c && c.label && Number(c.amount) > 0).map(c => {
          const amt = Number(Number(c.amount).toFixed(2));
          const chargeGstPct = isGST ? Number(c.gstPercent !== undefined ? c.gstPercent : 18) : 0;
          const chargeGstData = isGST
            ? calculateGstBreakdown({ taxableAmount: amt, gstPercent: chargeGstPct, partyState, partyGstin, isInterState })
            : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0, grandTotal: amt };
          return {
            id: c.id || Date.now(),
            label: String(c.label).trim(),
            amount: amt,
            gstPercent: chargeGstPct,
            taxableAmount: amt,
            gstAmount: chargeGstData.totalGst,
            cgstAmount: chargeGstData.cgstAmount,
            sgstAmount: chargeGstData.sgstAmount,
            igstAmount: chargeGstData.igstAmount,
            totalAmount: chargeGstData.grandTotal
          };
        })
      : [];

    for (const c of validElCharges) {
      totalTaxable = Number((totalTaxable + c.taxableAmount).toFixed(2));
      totalCgst = Number((totalCgst + c.cgstAmount).toFixed(2));
      totalSgst = Number((totalSgst + c.sgstAmount).toFixed(2));
      totalIgst = Number((totalIgst + c.igstAmount).toFixed(2));
    }

    const grandTotal = Number((totalTaxable + totalCgst + totalSgst + totalIgst + billOther - billDiscount + billRound).toFixed(2));

    const result = await runTransaction(async () => {
      // 1. Reverse previous stock movements
      for (const it of oldItemsToReverse) {
        const avail = await getRawMaterialStock(it.raw_material_id);
        const newBal = Number((avail - it.quantity).toFixed(2));
        await db.prepare(`
          INSERT INTO raw_material_movements (
            movement_type, reference_type, reference_id, raw_material_id, quantity_change,
            unit, balance_after, manager_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('ADJUSTMENT', 'PURCHASE_EDIT_REVERSAL', pur.purchase_code, it.raw_material_id, -it.quantity, it.unit || 'KG', newBal, 'Admin', `Reversed for purchase edit ${pur.purchase_code}`);
      }

      // 2. Void previous immediate payment if any
      await db.prepare("UPDATE payments SET is_voided = 1 WHERE reference_no IN (?, ?) AND party_type = 'SUPPLIER'").run(pur.invoice_number || '', pur.purchase_code);

      // 3. Delete old purchase items
      await db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(pur.id);

      // 4. Update header
      const firstItem = processedLines[0];
      await db.prepare(`
        UPDATE raw_material_purchases
        SET date = ?, supplier_id = ?, raw_material_id = ?, quantity_kg = ?, rate_per_kg = ?,
            taxable_amount = ?, gst_percent = ?, cgst_amount = ?, sgst_amount = ?, igst_amount = ?, total_amount = ?,
            purchase_type = ?, discount_amount = ?, other_charges = ?, round_off = ?, payment_mode = ?,
            invoice_number = ?, remarks = ?, el_charges = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        date, supp.id, firstItem.rawMaterialId, firstItem.quantity, firstItem.rate,
        totalTaxable, firstItem.gstPercent, totalCgst, totalSgst, totalIgst, grandTotal,
        purchaseType, billDiscount, billOther, billRound, paymentMode,
        invoiceNumber, remarks, JSON.stringify(validElCharges), pur.id
      );

      // 5. Insert new purchase items and add new stock movements
      const insertItem = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, raw_material_id, quantity, unit, rate, discount, hsn_code,
          gst_percent, taxable_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMov = db.prepare(`
        INSERT INTO raw_material_movements (
          movement_type, reference_type, reference_id, raw_material_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pl of processedLines) {
        await insertItem.run(
          pur.id, pl.rawMaterialId, pl.quantity, pl.unit, pl.rate, pl.discount,
          pl.hsnCode, pl.gstPercent, pl.taxableAmount, pl.gstAmount, pl.cgstAmount, pl.sgstAmount, pl.igstAmount, pl.totalAmount
        );

        const curStock = await getRawMaterialStock(pl.rawMaterialId);
        const newBal = Number((curStock + pl.quantity).toFixed(2));
        await insertMov.run(
          'PURCHASE', 'PURCHASE', pur.purchase_code, pl.rawMaterialId, pl.quantity,
          pl.unit, newBal, 'Admin', `Updated purchase invoice ${pur.purchase_code}`
        );
      }

      // 6. Audit Log
      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('PURCHASE', pur.purchase_code, 'UPDATE', JSON.stringify(pur), JSON.stringify({ grandTotal, itemsCount: processedLines.length, paymentMode }), 'Admin');

      return {
        id: pur.id,
        purchase_code: pur.purchase_code,
        date,
        total_amount: grandTotal,
        items: processedLines
      };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error updating purchase:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/purchases/:id', requireAdmin, async (req, res) => {
  try {
    const pur = await db.prepare('SELECT * FROM raw_material_purchases WHERE id = ?').get(req.params.id);
    if (!pur) return res.status(404).json({ error: 'Purchase record not found' });
    if (pur.is_voided) return res.json({ success: true, message: 'Purchase is already voided.' });

    const items = await db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(pur.id);
    const itemsToReverse = items.length > 0 ? items : [{ raw_material_id: pur.raw_material_id, quantity: pur.quantity_kg, unit: 'KG' }];

    // Verify stock availability to reverse
    for (const it of itemsToReverse) {
      const avail = await getRawMaterialStock(it.raw_material_id);
      if (avail < it.quantity) {
        return res.status(400).json({
          error: `Cannot void purchase: Material ID ${it.raw_material_id} has already been consumed in production (Available: ${avail}, Purchase: ${it.quantity}).`
        });
      }
    }

    await runTransaction(async () => {
      // 1. Reverse stock movements
      for (const it of itemsToReverse) {
        const avail = await getRawMaterialStock(it.raw_material_id);
        const newBal = Number((avail - it.quantity).toFixed(2));
        await db.prepare(`
          INSERT INTO raw_material_movements (
            movement_type, reference_type, reference_id, raw_material_id, quantity_change,
            unit, balance_after, manager_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('ADJUSTMENT', 'PURCHASE_VOID', pur.purchase_code, it.raw_material_id, -it.quantity, it.unit || 'KG', newBal, 'Admin', `Reversed from voided purchase ${pur.purchase_code}`);
      }

      // 2. If immediate payment was made, mark voided
      await db.prepare("UPDATE payments SET is_voided = 1 WHERE reference_no IN (?, ?) AND party_type = 'SUPPLIER'").run(pur.invoice_number || '', pur.purchase_code);

      // 3. Mark purchase voided
      await db.prepare(`
        UPDATE raw_material_purchases
        SET is_voided = 1, voided_at = CURRENT_TIMESTAMP, voided_by = 'Admin', void_reason = 'Admin Void'
        WHERE id = ?
      `).run(pur.id);

      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
        VALUES (?, ?, ?, ?, ?)
      `).run('PURCHASE', pur.purchase_code, 'VOID', JSON.stringify(pur), 'Admin');
    });

    res.json({ success: true, message: 'Purchase voided successfully and stock reversed.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// PRODUCTION BATCHES & PRODUCTION ENTRIES
// =============================================================
app.get('/api/transactions/production', async (req, res) => {
  try {
    const { dateFrom, dateTo, machineId, shiftId, rawMaterialId, managerName, includeVoided } = req.query;
    let query = `
      SELECT pb.*, m.name AS machine_name, m.machine_code, s.name AS shift_name,
             rm.name AS raw_material_name, rm.code AS raw_material_code,
             po.order_no AS production_order_no, cb.batch_no AS consumption_batch_no
      FROM production_batches pb
      LEFT JOIN machines m ON pb.machine_id = m.id
      LEFT JOIN shifts s ON pb.shift_id = s.id
      LEFT JOIN raw_materials rm ON pb.raw_material_id = rm.id
      LEFT JOIN production_orders po ON pb.production_order_id = po.id
      LEFT JOIN consumption_batches cb ON pb.consumption_batch_id = cb.id
      WHERE (pb.is_voided = 0 OR pb.is_voided IS NULL)
    `;
    if (includeVoided === 'true') {
      query = query.replace('WHERE (pb.is_voided = 0 OR pb.is_voided IS NULL)', 'WHERE 1=1');
    }
    const params = [];
    if (dateFrom) { query += ' AND pb.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND pb.date <= ?'; params.push(dateTo); }
    if (machineId) { query += ' AND pb.machine_id = ?'; params.push(machineId); }
    if (shiftId) { query += ' AND pb.shift_id = ?'; params.push(shiftId); }
    if (rawMaterialId) { query += ' AND pb.raw_material_id = ?'; params.push(rawMaterialId); }
    if (managerName) { query += ' AND pb.manager_name = ?'; params.push(managerName); }

    query += ' ORDER BY pb.id DESC';
    const batches = await db.prepare(query).all(...params);

    const getOutputs = db.prepare(`
      SELECT po.*, fp.product_name, fp.product_code, fp.gsm, fp.width_size, fp.length_val, fp.colour, fp.grade
      FROM production_outputs po
      JOIN finished_products fp ON po.finished_product_id = fp.id
      WHERE po.batch_id = ?
    `);

    const getConsumed = db.prepare(`
      SELECT cbi.*, rm.name AS raw_material_name, rm.code AS raw_material_code, rm.unit AS master_unit
      FROM consumption_batch_items cbi
      JOIN raw_materials rm ON cbi.raw_material_id = rm.id
      WHERE cbi.consumption_batch_id = ?
    `);

    const result = await Promise.all(batches.map(async batch => ({
      ...batch,
      outputs: await getOutputs.all(batch.id),
      consumed_materials: batch.consumption_batch_id ? await getConsumed.all(batch.consumption_batch_id) : []
    })));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/production', checkManagerModule('productions', 'Daily Production Batches'), async (req, res) => {
  try {
    let {
      date,
      machineId,
      shiftId,
      productionOrderId,
      consumptionBatchId,
      rawMaterialId, // optional if from consumption batch
      rawMaterialUsedKg, // optional if from consumption batch
      outputs, // Array of { finishedProductId, quantityKg, quantity, unit, gsm, widthSize, lengthVal, colour, grade }
      totalWastageKg,
      totalWastage,
      wastageUnit = 'KG',
      wastageReason = 'Machine Waste',
      remarks = '',
      managerName = 'Admin',
      managerId = null,
      deviceId = ''
    } = req.body;

    const wasteQty = Number(totalWastage !== undefined && totalWastage !== null ? totalWastage : (totalWastageKg !== undefined && totalWastageKg !== null ? totalWastageKg : 0));

    if (!Array.isArray(outputs) || outputs.length === 0) {
      return res.status(400).json({ error: 'Valid Date and at least one finished good output line are required.' });
    }

    let totalFinishedOutput = 0;
    for (const out of outputs) {
      const q = Number(out.quantity !== undefined ? out.quantity : out.quantityKg);
      if (isNaN(q) || q <= 0) {
        return res.status(400).json({ error: 'Every production output must have a positive quantity.' });
      }
      totalFinishedOutput += q;
    }
    totalFinishedOutput = Number(totalFinishedOutput.toFixed(2));

    // Handle Linked Material Issue / Consumption Batch
    let linkedBatch = null;
    if (consumptionBatchId) {
      linkedBatch = await db.prepare(`
        SELECT cb.*, po.order_no AS production_order_no
        FROM consumption_batches cb
        LEFT JOIN production_orders po ON cb.production_order_id = po.id
        WHERE cb.id = ?
      `).get(consumptionBatchId);

      if (!linkedBatch) {
        return res.status(400).json({ error: 'Material Issue Batch not found.' });
      }
      if (linkedBatch.status === 'Cancelled') {
        return res.status(400).json({ error: 'Cannot record production against a cancelled Material Issue Batch.' });
      }

      // Check if already used in a production entry
      const existingProd = await db.prepare('SELECT id, batch_code FROM production_batches WHERE consumption_batch_id = ? AND is_voided = 0').get(consumptionBatchId);
      if (existingProd || linkedBatch.status === 'Completed') {
        return res.status(400).json({
          error: 'This Material Issue Batch has already been used in a Production Entry.',
          existingBatchCode: existingProd ? existingProd.batch_code : undefined
        });
      }

      // Auto-inherit machine, shift, order, date if not explicitly passed
      if (!machineId) machineId = linkedBatch.machine_id;
      if (!shiftId) shiftId = linkedBatch.shift_id;
      if (!productionOrderId) productionOrderId = linkedBatch.production_order_id;
      if (!date) date = linkedBatch.date || new Date().toISOString().split('T')[0];
    } else {
      // Legacy standalone balance check (only when RM is directly specified without consumption batch)
      const rmUsed = (rawMaterialUsedKg !== undefined && rawMaterialUsedKg !== null && rawMaterialUsedKg !== '')
        ? Number(rawMaterialUsedKg)
        : 0;

      if (rmUsed > 0) {
        const availableRMStock = rawMaterialId ? await getRawMaterialStock(rawMaterialId) : 99999999;
        if (rawMaterialId && rmUsed > availableRMStock) {
          return res.status(400).json({
            error: `Insufficient Raw Material Stock. Available: ${availableRMStock.toLocaleString()} KG, Required: ${rmUsed.toLocaleString()} KG.`,
            available: availableRMStock,
            required: rmUsed
          });
        }

        const totalOutputAndWastage = Number((totalFinishedOutput + wasteQty).toFixed(2));
        const diff = Math.abs(totalOutputAndWastage - rmUsed);
        if (diff > 0.05) {
          return res.status(400).json({
            error: `Production Balance Mismatch: Total Finished Output (${totalFinishedOutput.toLocaleString()} KG) + Wastage (${wasteQty.toLocaleString()} KG) = ${totalOutputAndWastage.toLocaleString()} KG, which does not equal Raw Material Used (${rmUsed.toLocaleString()} KG). Difference: ${Number((totalOutputAndWastage - rmUsed).toFixed(2))} KG.`,
            totalFinishedKg: totalFinishedOutput,
            wastageKg: wasteQty,
            rawMaterialUsedKg: rmUsed,
            difference: Number((totalOutputAndWastage - rmUsed).toFixed(2))
          });
        }
      }
    }

    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    const finalManagerName = (req.role === 'manager' && req.manager) ? req.manager.name : (managerName || 'Admin');
    const finalManagerId = (req.role === 'manager' && req.manager) ? req.manager.id : (managerId || null);
    const finalDeviceId = (req.role === 'manager' && req.manager) ? (req.manager.device_id || deviceId || '') : (deviceId || '');

    const result = await runTransaction(async () => {
      const batchCode = await getNextCode('PROD', 'production_batches', 'batch_code');
      const rmUsed = (!consumptionBatchId && rawMaterialUsedKg) ? Number(rawMaterialUsedKg) : 0;

      // 1. Insert Production Batch
      const info = await db.prepare(`
        INSERT INTO production_batches (
          batch_code, date, machine_id, shift_id, raw_material_id, raw_material_used_kg,
          total_finished_kg, total_wastage_kg, wastage_reason, remarks, manager_id, manager_name, device_id,
          production_order_id, consumption_batch_id, wastage_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batchCode, date, machineId || null, shiftId || null, rawMaterialId || null, rmUsed,
        totalFinishedOutput, wasteQty, wastageReason, remarks, finalManagerId, finalManagerName, finalDeviceId,
        productionOrderId || null, consumptionBatchId || null, wastageUnit || 'KG'
      );
      const batchId = info.lastInsertRowid;

      // 2. Only if standalone RM was specified (NOT from issue batch), deduct RM movement
      if (!consumptionBatchId && rawMaterialId && rmUsed > 0) {
        const curStock = await getRawMaterialStock(rawMaterialId);
        const newRMBal = Number((curStock - rmUsed).toFixed(2));
        await db.prepare(`
          INSERT INTO raw_material_movements (
            movement_type, reference_type, reference_id, raw_material_id, quantity_change,
            unit, balance_after, manager_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('PRODUCTION_CONSUMPTION', 'PRODUCTION', batchCode, rawMaterialId, -rmUsed, 'KG', newRMBal, finalManagerName, `Batch ${batchCode} consumption`);
      }

      // 3. Insert Outputs & Finished Goods Movements
      const createdOutputs = [];
      const insertOutput = db.prepare(`
        INSERT INTO production_outputs (
          batch_id, finished_product_id, gsm, width_size, length_val, colour, grade, quantity_kg, unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertFGMovement = db.prepare(`
        INSERT INTO finished_goods_movements (
          movement_type, reference_type, reference_id, finished_product_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const out of outputs) {
        const outQty = Number(out.quantity !== undefined ? out.quantity : out.quantityKg);
        const fgItem = await db.prepare('SELECT * FROM finished_products WHERE id = ?').get(out.finishedProductId);
        if (!fgItem) {
          throw new Error(`Finished product specification with ID ${out.finishedProductId} does not exist.`);
        }
        const unit = out.unit || fgItem.unit || 'KG';

        const outRes = await insertOutput.run(
          batchId,
          out.finishedProductId,
          out.gsm || fgItem.gsm,
          out.widthSize || fgItem.width_size,
          out.lengthVal || fgItem.length_val,
          out.colour || fgItem.colour,
          out.grade || fgItem.grade,
          outQty,
          unit
        );

        const currentFGStock = await getFinishedGoodStock(out.finishedProductId);
        const newFGBalance = Number((currentFGStock + outQty).toFixed(2));

        await insertFGMovement.run(
          'PRODUCTION', 'PRODUCTION', batchCode, out.finishedProductId, outQty,
          unit, newFGBalance, finalManagerName, `Batch ${batchCode} output (${fgItem.product_code})`
        );

        createdOutputs.push({
          id: outRes.lastInsertRowid,
          finished_product_id: out.finishedProductId,
          product_name: fgItem.product_name,
          product_code: fgItem.product_code,
          quantity: outQty,
          quantity_kg: outQty,
          unit,
          current_stock: newFGBalance
        });
      }

      // 4. Store Wastage Separately in wastage_records
      if (wasteQty > 0) {
        await db.prepare(`
          INSERT INTO wastage_records (
            date, production_id, production_no, production_order_id, product_id,
            quantity, unit, reason, manager_name, machine_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          date, batchId, batchCode, productionOrderId || null,
          outputs[0]?.finishedProductId || null, wasteQty, wastageUnit || 'KG',
          wastageReason, finalManagerName, machineId || null
        );
      }

      // 5. If linked to Material Issue Batch, mark the consumption batch as 'Completed'
      if (consumptionBatchId) {
        await db.prepare("UPDATE consumption_batches SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(consumptionBatchId);
      }

      // 6. If linked to production order, update status if fully produced
      if (productionOrderId) {
        const order = await db.prepare('SELECT * FROM production_orders WHERE id = ?').get(productionOrderId);
        if (order && totalFinishedOutput >= order.required_quantity) {
          await db.prepare("UPDATE production_orders SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(productionOrderId);
        }
      }

      // 7. Audit Log
      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('PRODUCTION_BATCH', batchCode, 'CREATE', JSON.stringify({ consumptionBatchId, totalFinishedOutput, wasteQty, outputsCount: outputs.length }), finalManagerName, finalDeviceId);

      return {
        id: batchId,
        batch_code: batchCode,
        date,
        consumption_batch_id: consumptionBatchId || null,
        production_order_id: productionOrderId || null,
        raw_material_used_kg: rmUsed,
        total_finished_kg: totalFinishedOutput,
        total_wastage_kg: wasteQty,
        wastage_reason: wastageReason,
        outputs: createdOutputs,
        manager_name: finalManagerName
      };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating production batch:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/production/:id', requireAdmin, async (req, res) => {
  try {
    const batch = await db.prepare('SELECT * FROM production_batches WHERE id = ?').get(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Production batch not found' });
    if (batch.is_voided) return res.json({ success: true, message: 'Batch is already voided.' });

    const outputs = await db.prepare('SELECT * FROM production_outputs WHERE batch_id = ?').all(batch.id);

    // Verify finished good stock is still available to deduct
    for (const out of outputs) {
      const currentFGStock = await getFinishedGoodStock(out.finished_product_id);
      if (currentFGStock < out.quantity_kg) {
        return res.status(400).json({
          error: `Cannot void production batch: Finished goods stock (ID ${out.finished_product_id}) has already been sold. (Available: ${currentFGStock.toLocaleString()} KG, Batch Output: ${out.quantity_kg.toLocaleString()} KG).`
        });
      }
    }

    await runTransaction(async () => {
      // 1. Restore consumed Raw Material if any
      if (batch.raw_material_id && batch.raw_material_used_kg > 0) {
        const currentRMStock = await getRawMaterialStock(batch.raw_material_id);
        const newRMBalance = Number((currentRMStock + batch.raw_material_used_kg).toFixed(2));
        await db.prepare(`
          INSERT INTO raw_material_movements (
            movement_type, reference_type, reference_id, raw_material_id, quantity_change,
            unit, balance_after, manager_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('ADJUSTMENT', 'PRODUCTION_VOID', batch.batch_code, batch.raw_material_id, batch.raw_material_used_kg, 'KG', newRMBalance, 'Admin', `Restored from voided batch ${batch.batch_code}`);
      }

      // 2. Reverse Produced Finished Goods
      for (const out of outputs) {
        const fgStock = await getFinishedGoodStock(out.finished_product_id);
        const newFGBal = Number((fgStock - out.quantity_kg).toFixed(2));
        await db.prepare(`
          INSERT INTO finished_goods_movements (
            movement_type, reference_type, reference_id, finished_product_id, quantity_change,
            unit, balance_after, manager_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('ADJUSTMENT', 'PRODUCTION_VOID', batch.batch_code, out.finished_product_id, -out.quantity_kg, out.unit || 'KG', newFGBal, 'Admin', `Reversed from voided batch ${batch.batch_code}`);
      }

      // 3. Mark batch voided
      await db.prepare(`
        UPDATE production_batches
        SET is_voided = 1, voided_at = CURRENT_TIMESTAMP, voided_by = 'Admin', void_reason = 'Admin Void'
        WHERE id = ?
      `).run(batch.id);

      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
        VALUES (?, ?, ?, ?, ?)
      `).run('PRODUCTION_BATCH', batch.batch_code, 'VOID', JSON.stringify({ batch, outputs }), 'Admin');
    });

    res.json({ success: true, message: 'Production batch voided and stock restored successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// SALES BILLING (Multi-Item, Stock Check Guard, GST & Non-GST)
// =============================================================
// GET: Managers can read sales (to view their own entries and print invoices)
app.get('/api/transactions/sales', async (req, res) => {
  try {
    const { dateFrom, dateTo, customerId, finishedProductId, managerName, paymentType, includeVoided } = req.query;
    let query = `
      SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.gst_number AS customer_gstin,
             c.address AS customer_address, c.state AS customer_state,
             fp.product_name, fp.product_code, fp.gsm, fp.width_size, fp.length_val, fp.colour, fp.grade,
             fp.hsn_code AS product_hsn
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      LEFT JOIN finished_products fp ON s.finished_product_id = fp.id
      WHERE (s.is_voided = 0 OR s.is_voided IS NULL)
    `;
    if (includeVoided === 'true') {
      query = query.replace('WHERE (s.is_voided = 0 OR s.is_voided IS NULL)', 'WHERE 1=1');
    }
    const params = [];
    if (dateFrom) { query += ' AND s.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND s.date <= ?'; params.push(dateTo); }
    if (customerId) { query += ' AND s.customer_id = ?'; params.push(customerId); }
    if (finishedProductId) { query += ' AND s.finished_product_id = ?'; params.push(finishedProductId); }
    if (managerName) { query += ' AND s.manager_name = ?'; params.push(managerName); }
    if (paymentType) { query += ' AND s.payment_type = ?'; params.push(paymentType); }

    query += ' ORDER BY s.id DESC';
    const rows = await db.prepare(query).all(...params);

    const getItems = db.prepare(`
      SELECT si.*, fp.product_name, fp.product_code
      FROM sales_items si
      JOIN finished_products fp ON si.finished_product_id = fp.id
      WHERE si.sale_id = ?
    `);

    const result = await Promise.all(rows.map(async r => ({
      ...r,
      items: await getItems.all(r.id)
    })));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/sales', checkManagerModule('sales', 'Sales & Tax Invoices'), async (req, res) => {
  try {
    const {
      date,
      customerId,
      salesType = 'GST', // 'GST' or 'NON_GST'
      paymentType = 'Cash', // 'Cash', 'Credit', 'Bank', etc.
      invoiceNumber = '',
      stateCode = '',
      reverseCharge = 'No',
      billingAddress = '',
      shippingAddress = '',
      shippingName = '',
      customerGstin = '',
      termsConditions = '',
      discountAmount = 0,
      otherCharges = 0,
      roundOff = 0,
      remarks = '',
      managerName = 'Admin',
      managerId = null,
      deviceId = '',
      items, // Array of { finishedProductId, quantity, unit, rate, discount, gsm, size, hsnCode, gstPercent }
      finishedProductId, quantityKg, ratePerKg, gstPercent // legacy fallback
    } = req.body;

    const cust = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!cust) return res.status(400).json({ error: 'Valid Customer is required.' });

    const finalItems = Array.isArray(items) && items.length > 0
      ? items
      : (finishedProductId && quantityKg && ratePerKg ? [{
          finishedProductId,
          quantity: quantityKg,
          unit: 'KG',
          rate: ratePerKg,
          discount: 0,
          gstPercent
        }] : []);

    if (!date || !customerId || finalItems.length === 0) {
      return res.status(400).json({ error: 'Valid Date, Customer, and at least one finished good line are required.' });
    }

    // REQUIREMENT 23: STRICT STOCK VALIDATION BEFORE SALE
    // If stock is insufficient for ANY item: REJECT with HTTP 400.
    // No partial deductions, zero negative balance.
    for (const it of finalItems) {
      const q = Number(it.quantity || it.quantityKg);
      if (isNaN(q) || q <= 0) {
        return res.status(400).json({ error: 'Each sale line must have quantity > 0.' });
      }
      const fg = await db.prepare('SELECT * FROM finished_products WHERE id = ?').get(it.finishedProductId);
      if (!fg) {
        return res.status(400).json({ error: `Finished product ID ${it.finishedProductId} does not exist.` });
      }

      const availableFGStock = await getFinishedGoodStock(it.finishedProductId);
      if (q > availableFGStock) {
        return res.status(400).json({
          error: `Sale rejected. Insufficient finished goods stock for "${fg.product_name} (${fg.product_code})". Available: ${availableFGStock.toLocaleString()} ${it.unit || fg.unit || 'KG'}, Required: ${q.toLocaleString()} ${it.unit || fg.unit || 'KG'}, Short: ${Number((q - availableFGStock).toFixed(2)).toLocaleString()} ${it.unit || fg.unit || 'KG'}.`,
          available: availableFGStock,
          required: q,
          short: Number((q - availableFGStock).toFixed(2))
        });
      }
    }

    const partyState = cust.state || 'Gujarat';
    const partyGstin = cust.gst_number || '';
    const isGST = (salesType === 'GST');

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedLines = [];
    for (const it of finalItems) {
      const q = Number(it.quantity || it.quantityKg);
      const r = Number(it.rate || it.ratePerKg);
      const disc = Number(it.discount || 0);
      const fg = await db.prepare('SELECT * FROM finished_products WHERE id = ?').get(it.finishedProductId);

      const lineTaxable = Number(((q * r) - disc).toFixed(2));
      const lineGstPct = isGST ? Number(it.gstPercent !== undefined ? it.gstPercent : (fg.gst_percent || 18)) : 0;
      const gstData = isGST ? calculateGstBreakdown({ taxableAmount: lineTaxable, gstPercent: lineGstPct, partyState, partyGstin }) : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0, grandTotal: lineTaxable };

      totalTaxable += lineTaxable;
      totalCgst += gstData.cgstAmount;
      totalSgst += gstData.sgstAmount;
      totalIgst += gstData.igstAmount;

      processedLines.push({
        finishedProductId: it.finishedProductId,
        gsm: it.gsm || fg.gsm,
        size: it.size || fg.width_size,
        hsnCode: it.hsnCode || fg.hsn_code || '3926',
        quantity: q,
        unit: it.unit || fg.unit || 'KG',
        rate: r,
        discount: disc,
        gstPercent: lineGstPct,
        taxableAmount: lineTaxable,
        gstAmount: gstData.totalGst,
        cgstAmount: gstData.cgstAmount,
        sgstAmount: gstData.sgstAmount,
        igstAmount: gstData.igstAmount,
        totalAmount: gstData.grandTotal
      });
    }

    const billDiscount = Number(discountAmount || 0);
    const billOther = Number(otherCharges || 0);
    const billRound = Number(roundOff || 0);
    const grandTotal = Number((totalTaxable + totalCgst + totalSgst + totalIgst + billOther - billDiscount + billRound).toFixed(2));

    const finalManagerName = (req.role === 'manager' && req.manager) ? req.manager.name : (managerName || 'Admin');
    const finalManagerId = (req.role === 'manager' && req.manager) ? req.manager.id : (managerId || null);
    const finalDeviceId = (req.role === 'manager' && req.manager) ? (req.manager.device_id || deviceId || '') : (deviceId || '');

    const trimmedInv = (invoiceNumber && invoiceNumber.trim()) ? invoiceNumber.trim() : null;
    if (trimmedInv) {
      const existing = await db.prepare("SELECT id FROM sales WHERE invoice_number = ? AND is_voided = 0").get(trimmedInv);
      if (existing) {
        return res.status(400).json({ error: 'Invoice number already exists. Please enter a different invoice number.' });
      }
    }

    const result = await runTransaction(async () => {
      const saleCode = await getNextCode('SALE', 'sales', 'sale_code');
      const yearStr = new Date(date || Date.now()).getFullYear();
      let finalInvoice = trimmedInv;
      if (finalInvoice) {
        const existing = await db.prepare("SELECT id FROM sales WHERE invoice_number = ? AND is_voided = 0").get(finalInvoice);
        if (existing) {
          throw new Error('Invoice number already exists. Please enter a different invoice number.');
        }
      } else {
        finalInvoice = await getNextCode(`INV-${yearStr}`, 'sales', 'invoice_number');
      }
      const firstItem = processedLines[0];

      const finalStateCode = stateCode || cust.state_code || '24';
      const finalRevCharge = reverseCharge || 'No';
      const finalBilling = billingAddress || cust.billing_address || cust.address || '';
      const finalShipping = shippingAddress || cust.shipping_address || finalBilling;
      const finalShipName = shippingName || cust.name || '';
      const finalGstin = customerGstin || cust.gst_number || '';
      const finalTerms = termsConditions || '';

      // 1. Insert header
      const info = await db.prepare(`
        INSERT INTO sales (
          sale_code, invoice_number, date, customer_id, finished_product_id, quantity_kg, rate_per_kg,
          taxable_amount, gst_percent, cgst_amount, sgst_amount, igst_amount, total_amount,
          sales_type, payment_type, customer_gstin, billing_address, shipping_address,
          discount_amount, other_charges, round_off, remarks, manager_id, manager_name, device_id,
          state_code, reverse_charge, shipping_name, terms_conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleCode, finalInvoice, date, customerId, firstItem.finishedProductId, firstItem.quantity, firstItem.rate,
        totalTaxable, firstItem.gstPercent, totalCgst, totalSgst, totalIgst, grandTotal,
        salesType, paymentType, finalGstin, finalBilling, finalShipping,
        billDiscount, billOther, billRound, remarks, finalManagerId, finalManagerName, finalDeviceId,
        finalStateCode, finalRevCharge, finalShipName, finalTerms
      );
      const saleId = info.lastInsertRowid;

      // 2. Insert items & stock OUT
      const insertItem = db.prepare(`
        INSERT INTO sales_items (
          sale_id, finished_product_id, gsm, size, hsn_code, quantity, unit, rate, discount,
          gst_percent, taxable_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMov = db.prepare(`
        INSERT INTO finished_goods_movements (
          movement_type, reference_type, reference_id, finished_product_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pl of processedLines) {
        await insertItem.run(
          saleId, pl.finishedProductId, pl.gsm, pl.size, pl.hsnCode, pl.quantity, pl.unit,
          pl.rate, pl.discount, pl.gstPercent, pl.taxableAmount, pl.gstAmount, pl.cgstAmount, pl.sgstAmount, pl.igstAmount, pl.totalAmount
        );

        const currentFGStock = await getFinishedGoodStock(pl.finishedProductId);
        const newBalance = Number((currentFGStock - pl.quantity).toFixed(2));
        await insertMov.run(
          'SALE', 'SALE', saleCode, pl.finishedProductId, -pl.quantity,
          pl.unit, newBalance, finalManagerName, `Sale invoice ${finalInvoice}`
        );
      }

      // 3. Audit Log
      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('SALE', saleCode, 'CREATE', JSON.stringify({ itemsCount: processedLines.length, grandTotal, customerId, paymentType }), finalManagerName, finalDeviceId);

      return {
        id: saleId,
        sale_code: saleCode,
        invoice_number: finalInvoice,
        date,
        quantity_kg: firstItem.quantity,
        rate_per_kg: firstItem.rate,
        taxable_amount: totalTaxable,
        gst_percent: firstItem.gstPercent,
        cgst_amount: totalCgst,
        sgst_amount: totalSgst,
        igst_amount: totalIgst,
        total_amount: grandTotal,
        manager_name: finalManagerName,
        current_stock: await getFinishedGoodStock(firstItem.finishedProductId),
        items: processedLines
      };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating sale:', err);
    if (err.code === '23505' && (err.message.includes('invoice') || err.detail?.includes('invoice') || err.constraint?.includes('invoice'))) {
      return res.status(400).json({ error: 'Invoice number already exists. Please enter a different invoice number.' });
    }
    res.status(400).json({ error: err.message });
  }
});

// GET: Managers can read a single sale (for invoice printing)
app.get('/api/transactions/sales/:id', async (req, res) => {
  try {
    const sale = await db.prepare(`
      SELECT s.*, c.name AS customer_name, c.gst_number AS customer_gstin, c.state AS customer_state
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale record not found' });

    const items = await db.prepare(`
      SELECT si.*, fp.product_name, fp.product_code, fp.unit AS master_unit
      FROM sales_items si
      JOIN finished_products fp ON si.finished_product_id = fp.id
      WHERE si.sale_id = ?
    `).all(sale.id);

    res.json({ ...sale, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/transactions/sales/:id', requireAdmin, async (req, res) => {
  try {
    const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale record not found' });
    if (sale.is_voided) return res.status(400).json({ error: 'Cannot edit a voided sale.' });

    const {
      date,
      customerId,
      salesType = sale.sales_type || 'GST',
      paymentType = sale.payment_type || 'Credit',
      invoiceNumber = sale.invoice_number || '',
      stateCode,
      reverseCharge,
      billingAddress,
      shippingAddress,
      shippingName,
      customerGstin,
      termsConditions,
      discountAmount = 0,
      otherCharges = 0,
      roundOff = 0,
      remarks = '',
      items
    } = req.body;

    const trimmedInvoice = invoiceNumber ? String(invoiceNumber).trim() : '';
    if (trimmedInvoice) {
      const dup = await db.prepare('SELECT id FROM sales WHERE invoice_number = ? AND id != ? AND is_voided = 0').get(trimmedInvoice, sale.id);
      if (dup) {
        return res.status(400).json({ error: 'Invoice number already exists. Please enter a different invoice number.' });
      }
    }

    const cust = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId || sale.customer_id);
    if (!cust) return res.status(400).json({ error: 'Valid Customer is required.' });

    const finalItems = Array.isArray(items) && items.length > 0 ? items : [];
    if (!date || finalItems.length === 0) {
      return res.status(400).json({ error: 'Valid Date and at least one item line are required.' });
    }

    const partyState = cust.state || 'Gujarat';
    const partyGstin = cust.gst_number || '';
    const isGST = (salesType === 'GST');

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedLines = [];
    for (const it of finalItems) {
      const fpId = it.finishedProductId || it.finished_product_id;
      const q = Number(it.quantity || it.quantityKg || it.quantity_kg);
      const r = Number(it.rate || it.ratePerKg || it.rate_per_kg);
      const disc = Number(it.discount || 0);
      if (isNaN(q) || q <= 0 || isNaN(r) || r <= 0) {
        return res.status(400).json({ error: 'Each sale line must have quantity > 0 and rate > 0.' });
      }

      const fp = await db.prepare('SELECT * FROM finished_products WHERE id = ?').get(fpId);
      if (!fp) {
        return res.status(400).json({ error: `Finished product ID ${fpId} not found.` });
      }

      const lineTaxable = Number(((q * r) - disc).toFixed(2));
      const lineGstPct = isGST ? Number(it.gstPercent !== undefined ? it.gstPercent : (it.gst_percent !== undefined ? it.gst_percent : (fp.gst_percent || 18))) : 0;
      const gstData = isGST ? calculateGstBreakdown({ taxableAmount: lineTaxable, gstPercent: lineGstPct, partyState, partyGstin }) : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0, grandTotal: lineTaxable };

      totalTaxable += lineTaxable;
      totalCgst += gstData.cgstAmount;
      totalSgst += gstData.sgstAmount;
      totalIgst += gstData.igstAmount;

      processedLines.push({
        finishedProductId: fpId,
        quantity: q,
        unit: it.unit || fp.unit || 'KG',
        rate: r,
        discount: disc,
        gsm: it.gsm || fp.gsm,
        size: it.size || fp.width_size,
        hsnCode: it.hsnCode || it.hsn_code || fp.hsn_code || '3926',
        gstPercent: lineGstPct,
        taxableAmount: lineTaxable,
        gstAmount: gstData.totalGst,
        cgstAmount: gstData.cgstAmount,
        sgstAmount: gstData.sgstAmount,
        igstAmount: gstData.igstAmount,
        totalAmount: gstData.grandTotal
      });
    }

    const billDiscount = Number(discountAmount || 0);
    const billOther = Number(otherCharges || 0);
    const billRound = Number(roundOff || 0);
    const grandTotal = Number((totalTaxable + totalCgst + totalSgst + totalIgst + billOther - billDiscount + billRound).toFixed(2));

    const oldItems = await db.prepare('SELECT * FROM sales_items WHERE sale_id = ?').all(sale.id);
    const oldItemsToRestore = oldItems.length > 0 ? oldItems : [{ finished_product_id: sale.finished_product_id, quantity: sale.quantity_kg, unit: 'KG' }];

    // Stock verification: check if current stock + restored old stock is enough for new items
    const restoredMap = {};
    for (const oldIt of oldItemsToRestore) {
      restoredMap[oldIt.finished_product_id] = (restoredMap[oldIt.finished_product_id] || 0) + oldIt.quantity;
    }
    const neededMap = {};
    for (const newIt of processedLines) {
      neededMap[newIt.finishedProductId] = (neededMap[newIt.finishedProductId] || 0) + newIt.quantity;
    }
    for (const [fpIdStr, neededQty] of Object.entries(neededMap)) {
      const fpId = Number(fpIdStr);
      const curStock = await getFinishedGoodStock(fpId);
      const effectiveStock = curStock + (restoredMap[fpId] || 0);
      if (neededQty > effectiveStock) {
        return res.status(400).json({
          error: `Insufficient finished goods stock for product ID ${fpId} (Available: ${effectiveStock}, Required: ${neededQty}).`
        });
      }
    }

    const result = await runTransaction(async () => {
      // 1. Restore previous stock movements
      for (const it of oldItemsToRestore) {
        const curStock = await getFinishedGoodStock(it.finished_product_id);
        const newBal = Number((curStock + it.quantity).toFixed(2));
        await db.prepare(`
          INSERT INTO finished_goods_movements (
            movement_type, reference_type, reference_id, finished_product_id, quantity_change,
            unit, balance_after, manager_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('ADJUSTMENT', 'SALE_EDIT_REVERSAL', sale.sale_code, it.finished_product_id, it.quantity, it.unit || 'KG', newBal, 'Admin', `Restored for sale edit ${sale.sale_code}`);
      }

      // 2. Delete old sales items
      await db.prepare('DELETE FROM sales_items WHERE sale_id = ?').run(sale.id);

      // 3. Update header
      const firstItem = processedLines[0];
      const finalInvoice = trimmedInvoice || sale.invoice_number;
      const finalStateCode = stateCode !== undefined ? stateCode : (sale.state_code || cust.state_code || '24');
      const finalRevCharge = reverseCharge !== undefined ? reverseCharge : (sale.reverse_charge || 'No');
      const finalBilling = billingAddress !== undefined ? billingAddress : (sale.billing_address || cust.billing_address || cust.address || '');
      const finalShipping = shippingAddress !== undefined ? shippingAddress : (sale.shipping_address || cust.shipping_address || finalBilling);
      const finalShipName = shippingName !== undefined ? shippingName : (sale.shipping_name || cust.name || '');
      const finalGstin = customerGstin !== undefined ? customerGstin : (sale.customer_gstin || cust.gst_number || '');
      const finalTerms = termsConditions !== undefined ? termsConditions : (sale.terms_conditions || '');

      await db.prepare(`
        UPDATE sales
        SET date = ?, customer_id = ?, finished_product_id = ?, quantity_kg = ?, rate_per_kg = ?,
            taxable_amount = ?, gst_percent = ?, cgst_amount = ?, sgst_amount = ?, igst_amount = ?, total_amount = ?,
            sales_type = ?, payment_type = ?, customer_gstin = ?, billing_address = ?, shipping_address = ?,
            discount_amount = ?, other_charges = ?, round_off = ?, invoice_number = ?, remarks = ?,
            state_code = ?, reverse_charge = ?, shipping_name = ?, terms_conditions = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        date, cust.id, firstItem.finishedProductId, firstItem.quantity, firstItem.rate,
        totalTaxable, firstItem.gstPercent, totalCgst, totalSgst, totalIgst, grandTotal,
        salesType, paymentType, finalGstin, finalBilling, finalShipping,
        billDiscount, billOther, billRound, finalInvoice, remarks,
        finalStateCode, finalRevCharge, finalShipName, finalTerms,
        sale.id
      );

      // 4. Insert new items and deduct stock
      const insertItem = db.prepare(`
        INSERT INTO sales_items (
          sale_id, finished_product_id, gsm, size, hsn_code, quantity, unit, rate, discount,
          gst_percent, taxable_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMov = db.prepare(`
        INSERT INTO finished_goods_movements (
          movement_type, reference_type, reference_id, finished_product_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pl of processedLines) {
        await insertItem.run(
          sale.id, pl.finishedProductId, pl.gsm, pl.size, pl.hsnCode, pl.quantity, pl.unit,
          pl.rate, pl.discount, pl.gstPercent, pl.taxableAmount, pl.gstAmount, pl.cgstAmount, pl.sgstAmount, pl.igstAmount, pl.totalAmount
        );

        const currentFGStock = await getFinishedGoodStock(pl.finishedProductId);
        const newBalance = Number((currentFGStock - pl.quantity).toFixed(2));
        await insertMov.run(
          'SALE', 'SALE', sale.sale_code, pl.finishedProductId, -pl.quantity,
          pl.unit, newBalance, 'Admin', `Sale invoice ${finalInvoice} (Edited)`
        );
      }

      // 5. Audit Log
      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('SALE', sale.sale_code, 'EDIT', JSON.stringify(sale), JSON.stringify({ grandTotal, finalInvoice, items: processedLines }), 'Admin');

      return {
        id: sale.id,
        sale_code: sale.sale_code,
        invoice_number: finalInvoice,
        date,
        total_amount: grandTotal,
        items: processedLines
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error updating sale:', err);
    if (err.code === '23505' && (err.message.includes('invoice') || err.detail?.includes('invoice') || err.constraint?.includes('invoice'))) {
      return res.status(400).json({ error: 'Invoice number already exists. Please enter a different invoice number.' });
    }
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/sales/:id', requireAdmin, async (req, res) => {
  try {
    const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale record not found' });
    if (sale.is_voided) return res.json({ success: true, message: 'Sale is already voided.' });

    const items = await db.prepare('SELECT * FROM sales_items WHERE sale_id = ?').all(sale.id);
    const itemsToRestore = items.length > 0 ? items : [{ finished_product_id: sale.finished_product_id, quantity: sale.quantity_kg, unit: 'KG' }];

    await runTransaction(async () => {
      // 1. Restore finished goods stock
      for (const it of itemsToRestore) {
        const curStock = await getFinishedGoodStock(it.finished_product_id);
        const newBal = Number((curStock + it.quantity).toFixed(2));
        await db.prepare(`
          INSERT INTO finished_goods_movements (
            movement_type, reference_type, reference_id, finished_product_id, quantity_change,
            unit, balance_after, manager_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('ADJUSTMENT', 'SALE_VOID', sale.sale_code, it.finished_product_id, it.quantity, it.unit || 'KG', newBal, 'Admin', `Restored from voided sale ${sale.sale_code}`);
      }

      // 2. If immediate receipt was created, mark voided
      await db.prepare("UPDATE payments SET is_voided = 1 WHERE (reference_no = ? OR invoice_id = ?) AND party_type = 'CUSTOMER'").run(sale.invoice_number || sale.sale_code, sale.id);

      // 3. Mark sale voided
      await db.prepare(`
        UPDATE sales
        SET is_voided = 1, voided_at = CURRENT_TIMESTAMP, voided_by = 'Admin', void_reason = 'Admin Void'
        WHERE id = ?
      `).run(sale.id);

      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
        VALUES (?, ?, ?, ?, ?)
      `).run('SALE', sale.sale_code, 'VOID', JSON.stringify(sale), 'Admin');
    });

    res.json({ success: true, message: 'Sale voided successfully and stock restored.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. INVENTORY & RECONCILIATION API
// -------------------------------------------------------------

// Live Raw Material Stock
app.get('/api/inventory/raw-materials', async (req, res) => {
  const rows = await db.prepare(`
    SELECT rm.id, rm.code, rm.name, rm.category, rm.unit, rm.min_stock_alert, rm.status,
           COALESCE(SUM(m.quantity_change), 0) AS current_stock_kg,
           COALESCE(SUM(CASE WHEN m.movement_type = 'PURCHASE' THEN m.quantity_change ELSE 0 END), 0) AS total_purchased_kg,
           COALESCE(SUM(CASE WHEN m.movement_type IN ('CONSUMPTION', 'PRODUCTION_CONSUMPTION') THEN ABS(m.quantity_change) ELSE 0 END), 0) AS total_consumed_kg,
           COALESCE(SUM(CASE WHEN m.movement_type = 'ADJUSTMENT' THEN m.quantity_change ELSE 0 END), 0) AS total_adjusted_kg
    FROM raw_materials rm
    LEFT JOIN raw_material_movements m ON rm.id = m.raw_material_id
    GROUP BY rm.id
    ORDER BY rm.id ASC
  `).all();
  res.json(rows);
});

// Live Finished Goods Stock
app.get('/api/inventory/finished-goods', async (req, res) => {
  const rows = await db.prepare(`
    SELECT fp.id, fp.product_code, fp.product_name, fp.gsm, fp.width_size, fp.length_val, fp.colour, fp.grade, fp.unit, fp.min_stock_alert, fp.status,
           COALESCE(SUM(m.quantity_change), 0) AS current_stock_kg,
           COALESCE(SUM(CASE WHEN m.movement_type = 'PRODUCTION' THEN m.quantity_change ELSE 0 END), 0) AS total_produced_kg,
           COALESCE(SUM(CASE WHEN m.movement_type = 'SALE' THEN ABS(m.quantity_change) ELSE 0 END), 0) AS total_sold_kg,
           COALESCE(SUM(CASE WHEN m.movement_type = 'ADJUSTMENT' THEN m.quantity_change ELSE 0 END), 0) AS total_adjusted_kg
    FROM finished_products fp
    LEFT JOIN finished_goods_movements m ON fp.id = m.finished_product_id
    GROUP BY fp.id
    ORDER BY fp.id ASC
  `).all();
  res.json(rows);
});

// Complete Stock Movement Ledger
app.get('/api/inventory/ledger', requireAdmin, async (req, res) => {
  try {
    const { type, itemId, dateFrom, dateTo } = req.query;

    if (type === 'RAW_MATERIAL') {
      let query = `
        SELECT m.*, rm.name as item_name, rm.code as item_code
        FROM raw_material_movements m
        JOIN raw_materials rm ON m.raw_material_id = rm.id
        WHERE 1=1
      `;
      const params = [];
      if (itemId) { query += ' AND m.raw_material_id = ?'; params.push(itemId); }
      if (dateFrom) { query += ' AND date(m.created_at) >= ?'; params.push(dateFrom); }
      if (dateTo) { query += ' AND date(m.created_at) <= ?'; params.push(dateTo); }
      query += ' ORDER BY m.id DESC LIMIT 300';
      return res.json(await db.prepare(query).all(...params));
    }

    if (type === 'FINISHED_GOOD') {
      let query = `
        SELECT m.*, fp.product_name as item_name, fp.product_code as item_code,
               fp.gsm, fp.width_size, fp.colour, fp.grade
        FROM finished_goods_movements m
        JOIN finished_products fp ON m.finished_product_id = fp.id
        WHERE 1=1
      `;
      const params = [];
      if (itemId) { query += ' AND m.finished_product_id = ?'; params.push(itemId); }
      if (dateFrom) { query += ' AND date(m.created_at) >= ?'; params.push(dateFrom); }
      if (dateTo) { query += ' AND date(m.created_at) <= ?'; params.push(dateTo); }
      query += ' ORDER BY m.id DESC LIMIT 300';
      return res.json(await db.prepare(query).all(...params));
    }

    // Default: Combined movements
    const rmMovs = await db.prepare(`
      SELECT m.id, m.created_at, 'RAW_MATERIAL' as inventory_type, m.movement_type, m.reference_type, m.reference_id,
             m.raw_material_id as item_id, rm.name as item_name, rm.code as item_code,
             m.quantity_change, m.balance_after, m.manager_name, m.remarks
      FROM raw_material_movements m
      JOIN raw_materials rm ON m.raw_material_id = rm.id
      ORDER BY m.id DESC LIMIT 100
    `).all();

    const fgMovs = await db.prepare(`
      SELECT m.id, m.created_at, 'FINISHED_GOOD' as inventory_type, m.movement_type, m.reference_type, m.reference_id,
             m.finished_product_id as item_id, fp.product_name || ' (' || fp.gsm || ' GSM, ' || fp.width_size || ', ' || fp.colour || ')' as item_name,
             fp.product_code as item_code,
             m.quantity_change, m.balance_after, m.manager_name, m.remarks
      FROM finished_goods_movements m
      JOIN finished_products fp ON m.finished_product_id = fp.id
      ORDER BY m.id DESC LIMIT 100
    `).all();

    const combined = [...rmMovs, ...fgMovs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock Reconciliation API
app.get('/api/inventory/reconciliation', requireAdmin, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT sa.*,
        CASE 
          WHEN sa.item_type = 'RAW_MATERIAL' THEN (SELECT name FROM raw_materials WHERE id = sa.item_id)
          ELSE (SELECT product_name || ' (' || gsm || ' GSM ' || width_size || ' ' || colour || ')' FROM finished_products WHERE id = sa.item_id)
        END as item_name,
        CASE 
          WHEN sa.item_type = 'RAW_MATERIAL' THEN (SELECT code FROM raw_materials WHERE id = sa.item_id)
          ELSE (SELECT product_code FROM finished_products WHERE id = sa.item_id)
        END as item_code
      FROM stock_adjustments sa
      ORDER BY sa.id DESC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory/reconciliation', requireAdmin, async (req, res) => {
  try {
    const {
      date = new Date().toISOString().split('T')[0],
      itemType, // 'RAW_MATERIAL' or 'FINISHED_GOOD'
      itemId,
      physicalQuantityKg,
      reason = 'Physical count reconciliation',
      adjustedBy = 'Admin',
      deviceId = ''
    } = req.body;

    const physicalQty = Number(physicalQuantityKg);
    if (!itemType || !itemId || isNaN(physicalQty) || physicalQty < 0) {
      return res.status(400).json({ error: 'Valid Item Type, Item ID, and Physical Quantity (>=0) are required.' });
    }

    const result = await runTransaction(async () => {
      let systemQty = 0;
      if (itemType === 'RAW_MATERIAL') {
        systemQty = await getRawMaterialStock(itemId);
      } else if (itemType === 'FINISHED_GOOD') {
        systemQty = await getFinishedGoodStock(itemId);
      } else {
        throw new Error('Invalid item type. Must be RAW_MATERIAL or FINISHED_GOOD.');
      }

      const difference = Number((physicalQty - systemQty).toFixed(2));
      let status = 'MATCHED';
      if (difference < -0.001) status = 'SHORT';
      else if (difference > 0.001) status = 'EXCESS';

      const adjCode = await getNextCode('ADJ', 'stock_adjustments', 'adjustment_code');

      await db.prepare(`
        INSERT INTO stock_adjustments (
          adjustment_code, date, item_type, item_id, system_quantity_kg, physical_quantity_kg,
          difference_kg, status, reason, adjusted_by, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adjCode, date, itemType, itemId, systemQty, physicalQty, difference, status, reason, adjustedBy, deviceId);

      // If difference is non-zero, record in stock ledger to sync system stock to physical count
      if (Math.abs(difference) > 0.001) {
        if (itemType === 'RAW_MATERIAL') {
          await db.prepare(`
            INSERT INTO raw_material_movements (
              movement_type, reference_type, reference_id, raw_material_id, quantity_change,
              balance_after, manager_name, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run('ADJUSTMENT', 'RECONCILIATION', adjCode, itemId, difference, physicalQty, adjustedBy, `Reconciliation: ${status} (${reason})`);
        } else {
          await db.prepare(`
            INSERT INTO finished_goods_movements (
              movement_type, reference_type, reference_id, finished_product_id, quantity_change,
              balance_after, manager_name, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run('ADJUSTMENT', 'RECONCILIATION', adjCode, itemId, difference, physicalQty, adjustedBy, `Reconciliation: ${status} (${reason})`);
        }
      }

      await db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('STOCK_ADJUSTMENT', adjCode, 'RECONCILE', JSON.stringify({ itemType, itemId, systemQty, physicalQty, difference, status, reason }), adjustedBy, deviceId);

      return {
        adjustment_code: adjCode,
        date,
        itemType,
        itemId,
        systemQuantityKg: systemQty,
        physicalQuantityKg: physicalQty,
        differenceKg: difference,
        status,
        reason,
        adjustedBy
      };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error reconciling stock:', err);
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. MANAGER ACTIVITY & AUDIT REPORTS API
// -------------------------------------------------------------

app.get('/api/managers/activity', requireAdmin, async (req, res) => {
  try {
    const { managerName } = req.query;

    const managers = await db.prepare(`
      SELECT m.id, m.name, m.device_id, m.phone, m.status, m.created_at,
             (SELECT COUNT(*) FROM raw_material_purchases WHERE manager_name = m.name) AS purchase_count,
             (SELECT COUNT(*) FROM production_batches WHERE manager_name = m.name) AS production_count,
             (SELECT COUNT(*) FROM sales WHERE manager_name = m.name) AS sales_count,
             COALESCE((SELECT SUM(raw_material_used_kg) FROM production_batches WHERE manager_name = m.name), 0) AS total_rm_used_kg,
             COALESCE((SELECT SUM(total_finished_kg) FROM production_batches WHERE manager_name = m.name), 0) AS total_production_kg,
             COALESCE((SELECT SUM(quantity_kg) FROM sales WHERE manager_name = m.name), 0) AS total_sales_kg,
             COALESCE((SELECT SUM(total_amount) FROM sales WHERE manager_name = m.name), 0) AS total_sales_amount,
             COALESCE((SELECT SUM(total_wastage_kg) FROM production_batches WHERE manager_name = m.name), 0) AS total_wastage_kg
      FROM managers m
      ORDER BY m.name ASC
    `).all();

    let details = null;
    if (managerName) {
      const purchases = await db.prepare(`
        SELECT p.*, s.name as supplier_name, rm.name as raw_material_name
        FROM raw_material_purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN raw_materials rm ON p.raw_material_id = rm.id
        WHERE p.manager_name = ?
        ORDER BY p.id DESC
      `).all(managerName);

      const productions = await db.prepare(`
        SELECT pb.*, m.name as machine_name, s.name as shift_name, rm.name as raw_material_name
        FROM production_batches pb
        JOIN machines m ON pb.machine_id = m.id
        JOIN shifts s ON pb.shift_id = s.id
        JOIN raw_materials rm ON pb.raw_material_id = rm.id
        WHERE pb.manager_name = ?
        ORDER BY pb.id DESC
      `).all(managerName);

      const sales = await db.prepare(`
        SELECT s.*, c.name as customer_name, fp.product_name, fp.gsm, fp.width_size, fp.colour
        FROM sales s
        JOIN customers c ON s.customer_id = c.id
        JOIN finished_products fp ON s.finished_product_id = fp.id
        WHERE s.manager_name = ?
        ORDER BY s.id DESC
      `).all(managerName);

      details = { purchases, productions, sales };
    }

    res.json({ managers, details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Today's entries for the current manager's mobile app
app.get('/api/managers/my-entries', requireAdmin, async (req, res) => {
  try {
    const managerName = req.query.managerName || 'Admin';

    if (!managerName) {
      return res.status(400).json({ error: 'managerName query parameter is required.' });
    }

    const purchases = await db.prepare(`
      SELECT p.*, s.name as supplier_name, rm.name as raw_material_name, 'PURCHASE' as entry_type
      FROM raw_material_purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN raw_materials rm ON p.raw_material_id = rm.id
      WHERE p.manager_name = ?
      ORDER BY p.id DESC LIMIT 50
    `).all(managerName);

    const getPurItems = db.prepare(`
      SELECT pi.*, rm.name as raw_material_name, rm.code as raw_material_code
      FROM purchase_items pi
      JOIN raw_materials rm ON pi.raw_material_id = rm.id
      WHERE pi.purchase_id = ?
    `);
    const enrichedPurchases = await Promise.all(purchases.map(async p => ({
      ...p,
      items: await getPurItems.all(p.id)
    })));

    const productions = await db.prepare(`
      SELECT pb.*, m.name as machine_name, s.name as shift_name, rm.name as raw_material_name, 'PRODUCTION' as entry_type
      FROM production_batches pb
      LEFT JOIN machines m ON pb.machine_id = m.id
      LEFT JOIN shifts s ON pb.shift_id = s.id
      LEFT JOIN raw_materials rm ON pb.raw_material_id = rm.id
      WHERE pb.manager_name = ?
      ORDER BY pb.id DESC LIMIT 50
    `).all(managerName);

    const getProdOutputs = db.prepare(`
      SELECT po.*, fp.product_name, fp.product_code
      FROM production_outputs po
      JOIN finished_products fp ON po.finished_product_id = fp.id
      WHERE po.batch_id = ?
    `);
    const enrichedProductions = await Promise.all(productions.map(async pb => ({
      ...pb,
      outputs: await getProdOutputs.all(pb.id)
    })));

    const sales = await db.prepare(`
      SELECT s.*, c.name as customer_name, fp.product_name, fp.gsm, fp.width_size, fp.colour, 'SALE' as entry_type
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      LEFT JOIN finished_products fp ON s.finished_product_id = fp.id
      WHERE s.manager_name = ?
      ORDER BY s.id DESC LIMIT 50
    `).all(managerName);

    const getSaleItems = db.prepare(`
      SELECT si.*, fp.product_name, fp.product_code
      FROM sales_items si
      JOIN finished_products fp ON si.finished_product_id = fp.id
      WHERE si.sale_id = ?
    `);
    const enrichedSales = await Promise.all(sales.map(async s => ({
      ...s,
      items: await getSaleItems.all(s.id)
    })));

    const consumptionBatches = await db.prepare(`
      SELECT cb.*, po.order_no, m.name as machine_name, s.name as shift_name, 'CONSUMPTION' as entry_type
      FROM consumption_batches cb
      LEFT JOIN production_orders po ON cb.production_order_id = po.id
      LEFT JOIN machines m ON cb.machine_id = m.id
      LEFT JOIN shifts s ON cb.shift_id = s.id
      WHERE cb.manager_name = ?
      ORDER BY cb.id DESC LIMIT 50
    `).all(managerName);

    const receipts = await db.prepare(`
      SELECT p.*, c.name as party_name, 'RECEIPT' as entry_type
      FROM payments p
      JOIN customers c ON p.party_id = c.id
      WHERE p.manager_name = ? AND p.party_type = 'CUSTOMER'
      ORDER BY p.id DESC LIMIT 50
    `).all(managerName);

    const supplierPayments = await db.prepare(`
      SELECT p.*, s.name as party_name, 'SUPPLIER_PAYMENT' as entry_type
      FROM payments p
      JOIN suppliers s ON p.party_id = s.id
      WHERE p.manager_name = ? AND p.party_type = 'SUPPLIER'
      ORDER BY p.id DESC LIMIT 50
    `).all(managerName);

    // Compute today's summary stats for this specific manager
    const today = new Date().toISOString().split('T')[0];
    const todayPurchases = purchases.filter(p => p.date === today && !p.is_voided);
    const todayProductions = productions.filter(p => p.date === today && !p.is_voided);
    const todaySales = sales.filter(s => s.date === today && !s.is_voided);
    const todayConsumptions = consumptionBatches.filter(c => c.date === today);
    const todayReceipts = receipts.filter(r => r.date === today && !r.is_voided);
    const todaySuppPayments = supplierPayments.filter(sp => sp.date === today && !sp.is_voided);

    const todayStats = {
      purchaseCount: todayPurchases.length,
      purchaseKg: todayPurchases.reduce((acc, p) => acc + (p.quantity_kg || 0), 0),
      purchaseAmount: todayPurchases.reduce((acc, p) => acc + (p.total_amount || 0), 0),
      productionCount: todayProductions.length,
      productionKg: todayProductions.reduce((acc, p) => acc + (p.total_finished_kg || 0), 0),
      wastageKg: todayProductions.reduce((acc, p) => acc + (p.total_wastage_kg || 0), 0),
      salesCount: todaySales.length,
      salesKg: todaySales.reduce((acc, s) => acc + (s.quantity_kg || 0), 0),
      salesAmount: todaySales.reduce((acc, s) => acc + (s.total_amount || 0), 0),
      consumptionCount: todayConsumptions.length,
      receiptsCount: todayReceipts.length,
      receiptsAmount: todayReceipts.reduce((acc, r) => acc + (r.amount || 0), 0),
      paymentsCount: todaySuppPayments.length,
      paymentsAmount: todaySuppPayments.reduce((acc, sp) => acc + (sp.amount || 0), 0)
    };

    res.json({
      managerName,
      todayStats,
      purchases: enrichedPurchases,
      productions: enrichedProductions,
      sales: enrichedSales,
      consumptionBatches,
      receipts,
      supplierPayments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. DETAILED REPORTS API (Admin Only)
// -------------------------------------------------------------

// Wastage Report with product, machine, shift & reason breakdowns
app.get('/api/reports/wastage', requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, machineId, managerName } = req.query;
    let query = `
      SELECT pb.id, pb.batch_code, pb.date, pb.machine_id, m.name as machine_name,
             pb.shift_id, sh.name as shift_name,
             pb.raw_material_id, rm.name as raw_material_name,
             pb.raw_material_used_kg, pb.total_finished_kg, pb.total_wastage_kg,
             pb.wastage_reason, pb.manager_name,
             ROUND((pb.total_wastage_kg / NULLIF(pb.raw_material_used_kg, 0)) * 100, 2) AS wastage_percentage
      FROM production_batches pb
      LEFT JOIN machines m ON pb.machine_id = m.id
      LEFT JOIN shifts sh ON pb.shift_id = sh.id
      LEFT JOIN raw_materials rm ON pb.raw_material_id = rm.id
      WHERE pb.is_voided = 0 AND pb.total_wastage_kg > 0
    `;
    const params = [];
    if (dateFrom) { query += ' AND pb.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND pb.date <= ?'; params.push(dateTo); }
    if (machineId) { query += ' AND pb.machine_id = ?'; params.push(machineId); }
    if (managerName) { query += ' AND pb.manager_name = ?'; params.push(managerName); }

    query += ' ORDER BY pb.date DESC, pb.id DESC';
    const rows = await db.prepare(query).all(...params);

    const totalWastageKg = rows.reduce((s, r) => s + (r.total_wastage_kg || 0), 0);
    const totalRMUsedKg = rows.reduce((s, r) => s + (r.raw_material_used_kg || 0), 0);
    const overallWastagePercentage = totalRMUsedKg > 0 ? Number(((totalWastageKg / totalRMUsedKg) * 100).toFixed(2)) : 0;

    // Breakdown by Machine
    const byMachine = await db.prepare(`
      SELECT m.name as machine_name,
             SUM(pb.total_wastage_kg) as total_wastage_kg,
             SUM(pb.raw_material_used_kg) as total_rm_used_kg,
             ROUND((SUM(pb.total_wastage_kg) / NULLIF(SUM(pb.raw_material_used_kg), 0)) * 100, 2) as wastage_pct
      FROM production_batches pb
      JOIN machines m ON pb.machine_id = m.id
      WHERE pb.is_voided = 0 AND pb.total_wastage_kg > 0
      GROUP BY m.id
      ORDER BY total_wastage_kg DESC
    `).all();

    // Breakdown by Reason
    const byReason = await db.prepare(`
      SELECT COALESCE(NULLIF(pb.wastage_reason, ''), 'Process Waste') as reason,
             COUNT(*) as batch_count,
             SUM(pb.total_wastage_kg) as total_wastage_kg
      FROM production_batches pb
      WHERE pb.is_voided = 0 AND pb.total_wastage_kg > 0
      GROUP BY reason
      ORDER BY total_wastage_kg DESC
    `).all();

    // Breakdown by Product from wastage_records
    const byProduct = await db.prepare(`
      SELECT fp.product_name, fp.product_code,
             SUM(wr.quantity) as total_wastage_kg,
             COUNT(DISTINCT wr.production_id) as batch_count
      FROM wastage_records wr
      LEFT JOIN finished_products fp ON wr.product_id = fp.id
      GROUP BY fp.id
      ORDER BY total_wastage_kg DESC
    `).all();

    res.json({
      rows,
      byMachine,
      byReason,
      byProduct,
      summary: {
        totalWastageKg: Number(totalWastageKg.toFixed(2)),
        totalRMUsedKg: Number(totalRMUsedKg.toFixed(2)),
        overallWastagePercentage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consumption Report: Raw Materials Issued vs Finished Goods Produced
app.get('/api/reports/consumption', requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, managerName, machineId, customerId } = req.query;
    let query = `
      SELECT cb.*, po.order_no, c.name as customer_name, m.name as machine_name, s.name as shift_name
      FROM consumption_batches cb
      LEFT JOIN production_orders po ON cb.production_order_id = po.id
      LEFT JOIN customers c ON po.customer_id = c.id
      LEFT JOIN machines m ON cb.machine_id = m.id
      LEFT JOIN shifts s ON cb.shift_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (dateFrom) { query += ' AND cb.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND cb.date <= ?'; params.push(dateTo); }
    if (managerName) { query += ' AND cb.manager_name = ?'; params.push(managerName); }
    if (machineId) { query += ' AND cb.machine_id = ?'; params.push(machineId); }
    if (customerId) { query += ' AND po.customer_id = ?'; params.push(customerId); }
    query += ' ORDER BY cb.date DESC, cb.id DESC';

    const batches = await db.prepare(query).all(...params);
    const getItems = db.prepare(`
      SELECT cbi.*, rm.name as raw_material_name, rm.code as raw_material_code
      FROM consumption_batch_items cbi
      JOIN raw_materials rm ON cbi.raw_material_id = rm.id
      WHERE cbi.consumption_batch_id = ?
    `);

    const enriched = await Promise.all(batches.map(async b => {
      const items = await getItems.all(b.id);
      const totalIssuedQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      const linkedBatches = await db.prepare('SELECT * FROM production_batches WHERE consumption_batch_id = ? AND is_voided = 0').all(b.id);
      const totalProduced = linkedBatches.reduce((acc, pb) => acc + (Number(pb.total_finished_kg) || 0), 0);
      const totalWastage = linkedBatches.reduce((acc, pb) => acc + (Number(pb.total_wastage_kg) || 0), 0);
      const yieldPct = totalIssuedQty > 0 ? Number(((totalProduced / totalIssuedQty) * 100).toFixed(2)) : 0;
      return {
        ...b,
        items,
        totalIssuedQty: Number(totalIssuedQty.toFixed(2)),
        total_issued_kg: Number(totalIssuedQty.toFixed(2)),
        totalProduced: Number(totalProduced.toFixed(2)),
        totalWastage: Number(totalWastage.toFixed(2)),
        yieldPct
      };
    }));

    const grandIssued = enriched.reduce((acc, b) => acc + (b.total_issued_kg || b.totalIssuedQty || 0), 0);
    const grandProduced = enriched.reduce((acc, b) => acc + b.totalProduced, 0);
    const grandWastage = enriched.reduce((acc, b) => acc + b.totalWastage, 0);
    const overallYield = grandIssued > 0 ? Number(((grandProduced / grandIssued) * 100).toFixed(2)) : 0;

    res.json({
      batches: enriched,
      summary: {
        totalIssued: Number(grandIssued.toFixed(2)),
        total_issued_kg: Number(grandIssued.toFixed(2)),
        totalProduced: Number(grandProduced.toFixed(2)),
        totalWastage: Number(grandWastage.toFixed(2)),
        overallYield
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer Sales Report
app.get('/api/reports/customer-sales', requireAdmin, async (req, res) => {
  try {
    const { customerId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT c.id as customer_id, c.customer_code, c.name as customer_name, c.phone, c.gst_number,
             COUNT(s.id) as total_orders,
             COALESCE(SUM(s.quantity_kg), 0) as total_quantity_kg,
             COALESCE(SUM(s.total_amount), 0) as total_sales_amount,
             MAX(s.date) as last_purchase_date
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.is_voided = 0
      WHERE 1=1
    `;
    const params = [];
    if (customerId) { query += ' AND c.id = ?'; params.push(customerId); }
    if (dateFrom) { query += ' AND s.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND s.date <= ?'; params.push(dateTo); }

    query += ' GROUP BY c.id ORDER BY total_sales_amount DESC';
    const customers = await db.prepare(query).all(...params);

    let productBreakdown = [];
    if (customerId) {
      productBreakdown = await db.prepare(`
        SELECT fp.product_name, fp.product_code, fp.gsm, fp.width_size, fp.colour,
               SUM(si.quantity) as quantity_kg, SUM(si.total_amount) as total_amount
        FROM sales s
        JOIN sales_items si ON s.id = si.sale_id
        JOIN finished_products fp ON si.finished_product_id = fp.id
        WHERE s.customer_id = ? AND s.is_voided = 0
        GROUP BY fp.id
        ORDER BY quantity_kg DESC
      `).all(customerId);
    }

    res.json({ customers, productBreakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs
app.get('/api/audit-logs', requireAdmin, async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. ACCOUNTS, LEDGERS, BILLING & CA EXPORTS API (Admin Only)
// -------------------------------------------------------------

// Helper: Get active financial year
async function getActiveFinancialYear() {
  try {
    const row = await db.prepare('SELECT name FROM financial_years WHERE is_active = true OR is_active = 1 LIMIT 1').get();
    return row ? row.name : 'FY 2026-27';
  } catch {
    return 'FY 2026-27';
  }
}

// =============================================================
// FINANCIAL YEAR API
// =============================================================
app.get('/api/financial-years', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM financial_years ORDER BY start_date ASC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/financial-years', requireAdmin, async (req, res) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, Start Date, and End Date are required (e.g. FY 2027-28, 2027-04-01, 2028-03-31).' });
    }
    const cleanName = name.trim();
    if (isActive) {
      await db.prepare('UPDATE financial_years SET is_active = false').run();
    }
    const info = await db.prepare(`
      INSERT INTO financial_years (name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?)
    `).run(cleanName, startDate.trim(), endDate.trim(), Boolean(isActive));

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'CREATE', ?, 'Admin')
    `).run('FINANCIAL_YEAR', cleanName, JSON.stringify({ name: cleanName, startDate, endDate, isActive }));

    res.status(201).json({ id: info.lastInsertRowid, name: cleanName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/financial-years/active', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Financial year name is required.' });
    const fy = await db.prepare('SELECT * FROM financial_years WHERE name = ?').get(name.trim());
    if (!fy) return res.status(404).json({ error: 'Financial year not found.' });

    await db.prepare('UPDATE financial_years SET is_active = false').run();
    await db.prepare('UPDATE financial_years SET is_active = true WHERE name = ?').run(name.trim());

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'SWITCH_ACTIVE_FY', ?, 'Admin')
    `).run('FINANCIAL_YEAR', name.trim(), JSON.stringify({ active_financial_year: name.trim() }));

    res.json({ success: true, active_financial_year: name.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// BANK TRANSFERS API
// =============================================================
app.get('/api/accounts/bank-transfers', async (req, res) => {
  try {
    const { dateFrom, dateTo, bankId } = req.query;
    let query = `
      SELECT bt.*,
             fb.bank_name as from_bank_name, fb.account_name as from_account_name,
             tb.bank_name as to_bank_name, tb.account_name as to_account_name
      FROM bank_transfers bt
      LEFT JOIN bank_accounts fb ON bt.from_bank_id = fb.id
      LEFT JOIN bank_accounts tb ON bt.to_bank_id = tb.id
      WHERE bt.is_voided = 0
    `;
    const params = [];
    if (bankId) {
      query += ' AND (bt.from_bank_id = ? OR bt.to_bank_id = ?)';
      params.push(bankId, bankId);
    }
    if (dateFrom) { query += ' AND bt.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND bt.date <= ?'; params.push(dateTo); }
    query += ' ORDER BY bt.date DESC, bt.id DESC';
    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/bank-transfers', requireAdmin, async (req, res) => {
  try {
    const { date, fromBankId, toBankId, fromBankAccountId, toBankAccountId, amount, referenceNo, remarks } = req.body;
    const finalFromId = fromBankId || fromBankAccountId;
    const finalToId = toBankId || toBankAccountId;
    const numAmount = Number(amount);
    if (!date || !finalFromId || !finalToId || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid Date, From Bank, To Bank, and Amount (>0) are required.' });
    }
    if (Number(finalFromId) === Number(finalToId)) {
      return res.status(400).json({ error: 'From Bank and To Bank cannot be the same account.' });
    }

    const fromBank = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(finalFromId);
    const toBank = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(finalToId);
    if (!fromBank || !toBank) {
      return res.status(400).json({ error: 'Selected bank accounts must exist.' });
    }

    const code = await getNextCode('BT', 'bank_transfers', 'transfer_code');
    const info = await db.prepare(`
      INSERT INTO bank_transfers (transfer_code, date, from_bank_id, to_bank_id, amount, reference_no, remarks, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Admin')
    `).run(code, date, Number(finalFromId), Number(finalToId), numAmount, referenceNo || null, remarks || null);

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'CREATE', ?, 'Admin')
    `).run('BANK_TRANSFER', code, JSON.stringify({ transfer_code: code, date, fromBankId, toBankId, amount: numAmount, referenceNo }));

    res.status(201).json({ id: info.lastInsertRowid, transfer_code: code, amount: numAmount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/accounts/bank-transfers/:id', requireAdmin, async (req, res) => {
  try {
    const bt = await db.prepare('SELECT * FROM bank_transfers WHERE id = ?').get(req.params.id);
    if (!bt) return res.status(404).json({ error: 'Bank transfer not found.' });
    if (bt.is_voided) return res.status(400).json({ error: 'Bank transfer is already voided.' });

    await db.prepare('UPDATE bank_transfers SET is_voided = 1 WHERE id = ?').run(bt.id);

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
      VALUES (?, ?, 'VOID', ?, 'Admin')
    `).run('BANK_TRANSFER', bt.transfer_code, JSON.stringify(bt));

    res.json({ success: true, message: 'Bank transfer voided.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// OPENING BALANCES API
// =============================================================
app.get('/api/accounts/opening-balances', async (req, res) => {
  try {
    const { financialYear, entityType } = req.query;
    const activeFy = financialYear || await getActiveFinancialYear();
    let query = `
      SELECT ob.*,
             CASE
               WHEN ob.entity_type = 'RAW_MATERIAL' THEN (SELECT name FROM raw_materials WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'FINISHED_GOOD' THEN (SELECT product_name || ' (' || gsm || ' GSM, ' || width_size || ', ' || colour || ')' FROM finished_products WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'CUSTOMER' THEN (SELECT name FROM customers WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'SUPPLIER' THEN (SELECT name FROM suppliers WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'BANK' THEN (SELECT bank_name || ' - ' || account_name FROM bank_accounts WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'CASH' THEN 'Cash in Hand'
               ELSE 'Unknown'
             END as entity_name,
             CASE
               WHEN ob.entity_type = 'RAW_MATERIAL' THEN (SELECT code FROM raw_materials WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'FINISHED_GOOD' THEN (SELECT product_code FROM finished_products WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'CUSTOMER' THEN (SELECT customer_code FROM customers WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'SUPPLIER' THEN (SELECT supplier_code FROM suppliers WHERE id = ob.entity_id)
               WHEN ob.entity_type = 'BANK' THEN (SELECT account_number FROM bank_accounts WHERE id = ob.entity_id)
               ELSE ''
             END as entity_code
      FROM opening_balances ob
      WHERE ob.financial_year = ?
    `;
    const params = [activeFy];
    if (entityType) {
      query += ' AND ob.entity_type = ?';
      params.push(entityType);
    }
    query += ' ORDER BY ob.entity_type ASC, ob.id ASC';
    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/opening-balances', requireAdmin, async (req, res) => {
  try {
    const {
      financialYear,
      openingDate,
      entityType, // 'RAW_MATERIAL', 'FINISHED_GOOD', 'CUSTOMER', 'SUPPLIER', 'CASH', 'BANK'
      entityId = 0,
      quantity = 0,
      unit,
      rate = 0,
      amount = 0,
      balanceType = 'Dr',
      gsm,
      size,
      remarks = ''
    } = req.body;

    const fy = financialYear || await getActiveFinancialYear();
    if (!fy || !openingDate || !entityType) {
      return res.status(400).json({ error: 'Financial Year, Opening Date, and Entity Type are required.' });
    }

    let normType = entityType;
    if (normType === 'RM') normType = 'RAW_MATERIAL';
    if (normType === 'FG') normType = 'FINISHED_GOOD';
    if (normType === 'BANK_ACCOUNT') normType = 'BANK';

    const entId = normType === 'CASH' ? 0 : Number(entityId);
    if (normType !== 'CASH' && (!entId || isNaN(entId))) {
      return res.status(400).json({ error: `Valid ${normType} selection is required.` });
    }

    // Duplicate protection: Check if record already exists
    const existing = await db.prepare(`
      SELECT * FROM opening_balances
      WHERE financial_year = ? AND entity_type = ? AND entity_id = ?
    `).get(fy, normType, entId);

    if (existing) {
      return res.status(409).json({
        error: `Opening balance already exists for this ${normType} in ${fy}. Please edit the existing entry instead of creating a duplicate.`
      });
    }

    const numQty = Number(quantity) || 0;
    const numRate = Number(rate) || 0;
    const numAmount = (numQty > 0 && numRate > 0) ? Number((numQty * numRate).toFixed(2)) : (Number(amount) || 0);

    const info = await db.prepare(`
      INSERT INTO opening_balances (
        financial_year, opening_date, entity_type, entity_id, quantity, unit, rate, amount, balance_type, gsm, size, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Admin')
    `).run(
      fy, openingDate, normType, entId, numQty, unit || (normType === 'RAW_MATERIAL' || normType === 'FINISHED_GOOD' ? 'KG' : null),
      numRate, numAmount, balanceType || 'Dr', gsm ? Number(gsm) : null, size || null, remarks || null
    );

    const opId = info.lastInsertRowid;
    const refId = `OPENING-${normType}-${opId}`;

    // Integrate with stock movement tables if RM or FG
    if (normType === 'RAW_MATERIAL') {
      const curStock = await getRawMaterialStock(entId);
      const newBal = Number((curStock + numQty).toFixed(2));
      await db.prepare(`
        INSERT INTO raw_material_movements (
          movement_type, reference_type, reference_id, raw_material_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Admin', ?)
      `).run('OPENING', 'OPENING_STOCK', refId, entId, numQty, unit || 'KG', newBal, remarks || 'RM Opening Stock');
    } else if (normType === 'FINISHED_GOOD') {
      const curStock = await getFinishedGoodStock(entId);
      const newBal = Number((curStock + numQty).toFixed(2));
      await db.prepare(`
        INSERT INTO finished_goods_movements (
          movement_type, reference_type, reference_id, finished_product_id, quantity_change,
          unit, balance_after, manager_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Admin', ?)
      `).run('OPENING', 'OPENING_STOCK', refId, entId, numQty, unit || 'KG', newBal, remarks || 'FG Opening Stock');
    }

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'CREATE', ?, 'Admin')
    `).run('OPENING_BALANCE', String(opId), JSON.stringify({ fy, entityType, entId, numQty, numAmount, balanceType }));

    res.status(201).json({ id: opId, financial_year: fy, entity_type: entityType, entity_id: entId, amount: numAmount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/accounts/opening-balances/:id', requireAdmin, async (req, res) => {
  try {
    const ob = await db.prepare('SELECT * FROM opening_balances WHERE id = ?').get(req.params.id);
    if (!ob) return res.status(404).json({ error: 'Opening balance record not found.' });

    const { openingDate, quantity, unit, rate, amount, balanceType, gsm, size, remarks } = req.body;
    const numQty = quantity !== undefined ? Number(quantity) : Number(ob.quantity);
    const numRate = rate !== undefined ? Number(rate) : Number(ob.rate);
    const numAmount = (numQty > 0 && numRate > 0) ? Number((numQty * numRate).toFixed(2)) : (amount !== undefined ? Number(amount) : Number(ob.amount));

    await db.prepare(`
      UPDATE opening_balances
      SET opening_date = COALESCE(?, opening_date),
          quantity = ?,
          unit = COALESCE(?, unit),
          rate = ?,
          amount = ?,
          balance_type = COALESCE(?, balance_type),
          gsm = COALESCE(?, gsm),
          size = COALESCE(?, size),
          remarks = COALESCE(?, remarks),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      openingDate ?? null,
      numQty,
      unit ?? null,
      numRate,
      numAmount,
      balanceType ?? null,
      gsm !== undefined ? Number(gsm) : null,
      size ?? null,
      remarks ?? null,
      ob.id
    );

    const refId = `OPENING-${ob.entity_type}-${ob.id}`;
    if (ob.entity_type === 'RAW_MATERIAL') {
      await db.prepare(`
        UPDATE raw_material_movements
        SET quantity_change = ?, unit = ?, remarks = ?
        WHERE reference_type = 'OPENING_STOCK' AND reference_id = ?
      `).run(numQty, unit || ob.unit || 'KG', remarks || 'RM Opening Stock (Edited)', refId);
    } else if (ob.entity_type === 'FINISHED_GOOD') {
      await db.prepare(`
        UPDATE finished_goods_movements
        SET quantity_change = ?, unit = ?, remarks = ?
        WHERE reference_type = 'OPENING_STOCK' AND reference_id = ?
      `).run(numQty, unit || ob.unit || 'KG', remarks || 'FG Opening Stock (Edited)', refId);
    }

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
      VALUES (?, ?, 'EDIT', ?, ?, 'Admin')
    `).run('OPENING_BALANCE', String(ob.id), JSON.stringify(ob), JSON.stringify(req.body));

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/accounts/opening-balances/:id', requireAdmin, async (req, res) => {
  try {
    const ob = await db.prepare('SELECT * FROM opening_balances WHERE id = ?').get(req.params.id);
    if (!ob) return res.status(404).json({ error: 'Opening balance record not found.' });

    const refId = `OPENING-${ob.entity_type}-${ob.id}`;
    if (ob.entity_type === 'RAW_MATERIAL') {
      await db.prepare("DELETE FROM raw_material_movements WHERE reference_type = 'OPENING_STOCK' AND reference_id = ?").run(refId);
    } else if (ob.entity_type === 'FINISHED_GOOD') {
      await db.prepare("DELETE FROM finished_goods_movements WHERE reference_type = 'OPENING_STOCK' AND reference_id = ?").run(refId);
    }

    await db.prepare('DELETE FROM opening_balances WHERE id = ?').run(ob.id);

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
      VALUES (?, ?, 'DELETE', ?, 'Admin')
    `).run('OPENING_BALANCE', String(ob.id), JSON.stringify(ob));

    res.json({ success: true, message: 'Opening balance deleted.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// FINANCIAL YEAR CARRY FORWARD API
// =============================================================
app.post('/api/accounts/carry-forward', requireAdmin, async (req, res) => {
  try {
    const { sourceYear, targetYear, openingDate } = req.body;
    if (!sourceYear || !targetYear || !openingDate) {
      return res.status(400).json({ error: 'Source Financial Year, Target Financial Year, and Opening Date are required.' });
    }

    const srcFy = await db.prepare('SELECT * FROM financial_years WHERE name = ?').get(sourceYear.trim());
    if (!srcFy) return res.status(400).json({ error: `Source financial year ${sourceYear} not found.` });

    const closingDate = srcFy.end_date;
    const results = {
      customers: 0,
      suppliers: 0,
      cash: 0,
      banks: 0,
      rawMaterials: 0,
      finishedGoods: 0
    };

    // 1. Customers Closing Balances
    const customers = await db.prepare("SELECT * FROM customers WHERE status = 'active'").all();
    for (const c of customers) {
      const opRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'CUSTOMER' AND entity_id = ? AND financial_year = ?").get(c.id, sourceYear);
      let op = 0;
      if (opRec) {
        op = opRec.balance_type === 'Cr' ? -Number(opRec.amount) : Number(opRec.amount);
      } else {
        op = (c.opening_balance_type === 'CREDIT' || c.opening_balance_type === 'Cr') ? -Number(c.opening_balance || 0) : Number(c.opening_balance || 0);
      }

      const salesRow = await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE customer_id = ? AND date <= ? AND is_voided = 0').get(c.id, closingDate);
      const recRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'CUSTOMER' AND party_id = ? AND date <= ? AND is_voided = 0").get(c.id, closingDate);
      const dnRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'DEBIT_NOTE' AND party_type = 'CUSTOMER' AND party_id = ? AND date <= ? AND is_voided = 0").get(c.id, closingDate);
      const cnRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'CREDIT_NOTE' AND party_type = 'CUSTOMER' AND party_id = ? AND date <= ? AND is_voided = 0").get(c.id, closingDate);

      const netClosing = Number((op + Number(salesRow.total) + Number(dnRow.total) - Number(cnRow.total) - Number(recRow.total)).toFixed(2));
      if (netClosing !== 0) {
        const balType = netClosing >= 0 ? 'Dr' : 'Cr';
        const absAmt = Math.abs(netClosing);
        await db.prepare(`
          INSERT INTO opening_balances (
            financial_year, opening_date, entity_type, entity_id, amount, balance_type, remarks, created_by
          ) VALUES (?, ?, 'CUSTOMER', ?, ?, ?, ?, 'Admin')
          ON CONFLICT (financial_year, entity_type, entity_id) DO UPDATE
          SET amount = EXCLUDED.amount, balance_type = EXCLUDED.balance_type, opening_date = EXCLUDED.opening_date, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
        `).run(targetYear, openingDate, c.id, absAmt, balType, `Carried forward from ${sourceYear} closing`);
        results.customers++;
      }
    }

    // 2. Suppliers Closing Balances
    const suppliers = await db.prepare("SELECT * FROM suppliers WHERE status = 'active'").all();
    for (const s of suppliers) {
      const opRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'SUPPLIER' AND entity_id = ? AND financial_year = ?").get(s.id, sourceYear);
      let op = 0;
      if (opRec) {
        op = opRec.balance_type === 'Dr' ? -Number(opRec.amount) : Number(opRec.amount);
      } else {
        op = (s.opening_balance_type === 'DEBIT' || s.opening_balance_type === 'Dr') ? -Number(s.opening_balance || 0) : Number(s.opening_balance || 0);
      }

      const purRow = await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE supplier_id = ? AND date <= ? AND is_voided = 0').get(s.id, closingDate);
      const payRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ? AND date <= ? AND is_voided = 0").get(s.id, closingDate);
      const cnRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'CREDIT_NOTE' AND party_type = 'SUPPLIER' AND party_id = ? AND date <= ? AND is_voided = 0").get(s.id, closingDate);
      const dnRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'DEBIT_NOTE' AND party_type = 'SUPPLIER' AND party_id = ? AND date <= ? AND is_voided = 0").get(s.id, closingDate);

      const netClosing = Number((op + Number(purRow.total) + Number(cnRow.total) - Number(dnRow.total) - Number(payRow.total)).toFixed(2));
      if (netClosing !== 0) {
        const balType = netClosing >= 0 ? 'Cr' : 'Dr';
        const absAmt = Math.abs(netClosing);
        await db.prepare(`
          INSERT INTO opening_balances (
            financial_year, opening_date, entity_type, entity_id, amount, balance_type, remarks, created_by
          ) VALUES (?, ?, 'SUPPLIER', ?, ?, ?, ?, 'Admin')
          ON CONFLICT (financial_year, entity_type, entity_id) DO UPDATE
          SET amount = EXCLUDED.amount, balance_type = EXCLUDED.balance_type, opening_date = EXCLUDED.opening_date, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
        `).run(targetYear, openingDate, s.id, absAmt, balType, `Carried forward from ${sourceYear} closing`);
        results.suppliers++;
      }
    }

    // 3. Cash Closing Balance
    const cashOpRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'CASH' AND financial_year = ?").get(sourceYear);
    let cashOp = cashOpRec ? (cashOpRec.balance_type === 'Cr' ? -Number(cashOpRec.amount) : Number(cashOpRec.amount)) : 0;
    const cashRecRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_mode = 'Cash' AND party_type = 'CUSTOMER' AND date <= ? AND is_voided = 0").get(closingDate);
    const cashPayRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_mode = 'Cash' AND party_type = 'SUPPLIER' AND date <= ? AND is_voided = 0").get(closingDate);
    const cashSaleRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE payment_type = 'Cash' AND date <= ? AND is_voided = 0").get(closingDate);
    const cashPurRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE payment_mode = 'Cash' AND date <= ? AND is_voided = 0").get(closingDate);

    const netCashClosing = Number((cashOp + Number(cashRecRow.total) + Number(cashSaleRow.total) - Number(cashPayRow.total) - Number(cashPurRow.total)).toFixed(2));
    if (netCashClosing !== 0) {
      await db.prepare(`
        INSERT INTO opening_balances (
          financial_year, opening_date, entity_type, entity_id, amount, balance_type, remarks, created_by
        ) VALUES (?, ?, 'CASH', 0, ?, ?, ?, 'Admin')
        ON CONFLICT (financial_year, entity_type, entity_id) DO UPDATE
        SET amount = EXCLUDED.amount, balance_type = EXCLUDED.balance_type, opening_date = EXCLUDED.opening_date, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
      `).run(targetYear, openingDate, Math.abs(netCashClosing), netCashClosing >= 0 ? 'Dr' : 'Cr', `Carried forward cash from ${sourceYear} closing`);
      results.cash = 1;
    }

    // 4. Bank-wise Closing Balances
    const banks = await db.prepare("SELECT * FROM bank_accounts WHERE status = 'active'").all();
    for (const b of banks) {
      const bOpRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'BANK' AND entity_id = ? AND financial_year = ?").get(b.id, sourceYear);
      let bOp = bOpRec ? (bOpRec.balance_type === 'Cr' ? -Number(bOpRec.amount) : Number(bOpRec.amount)) : (b.opening_balance_type === 'Cr' ? -Number(b.opening_balance || 0) : Number(b.opening_balance || 0));

      const bRecRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE bank_account_id = ? AND party_type = 'CUSTOMER' AND date <= ? AND is_voided = 0").get(b.id, closingDate);
      const bPayRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE bank_account_id = ? AND party_type = 'SUPPLIER' AND date <= ? AND is_voided = 0").get(b.id, closingDate);
      const tfInRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM bank_transfers WHERE to_bank_id = ? AND date <= ? AND is_voided = 0").get(b.id, closingDate);
      const tfOutRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM bank_transfers WHERE from_bank_id = ? AND date <= ? AND is_voided = 0").get(b.id, closingDate);

      const netBankClosing = Number((bOp + Number(bRecRow.total) + Number(tfInRow.total) - Number(bPayRow.total) - Number(tfOutRow.total)).toFixed(2));
      if (netBankClosing !== 0) {
        await db.prepare(`
          INSERT INTO opening_balances (
            financial_year, opening_date, entity_type, entity_id, amount, balance_type, remarks, created_by
          ) VALUES (?, ?, 'BANK', ?, ?, ?, ?, 'Admin')
          ON CONFLICT (financial_year, entity_type, entity_id) DO UPDATE
          SET amount = EXCLUDED.amount, balance_type = EXCLUDED.balance_type, opening_date = EXCLUDED.opening_date, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
        `).run(targetYear, openingDate, b.id, Math.abs(netBankClosing), netBankClosing >= 0 ? 'Dr' : 'Cr', `Carried forward from ${sourceYear} closing`);
        results.banks++;
      }
    }

    // 5. Raw Material Closing Stocks
    const rms = await db.prepare("SELECT * FROM raw_materials WHERE status = 'active'").all();
    for (const rm of rms) {
      const stockRow = await db.prepare(`
        SELECT COALESCE(SUM(quantity_change), 0) as stock
        FROM raw_material_movements
        WHERE raw_material_id = ? AND date(created_at) <= ?
      `).get(rm.id, closingDate);
      const curStock = Number(stockRow.stock || 0);
      if (curStock > 0) {
        await db.prepare(`
          INSERT INTO opening_balances (
            financial_year, opening_date, entity_type, entity_id, quantity, unit, amount, balance_type, remarks, created_by
          ) VALUES (?, ?, 'RAW_MATERIAL', ?, ?, ?, 0, 'Dr', ?, 'Admin')
          ON CONFLICT (financial_year, entity_type, entity_id) DO UPDATE
          SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, opening_date = EXCLUDED.opening_date, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
        `).run(targetYear, openingDate, rm.id, curStock, rm.unit || 'KG', `Carried forward stock from ${sourceYear}`);

        const cfRef = `OPENING-RM-CF-${targetYear}-${rm.id}`;
        await db.prepare('DELETE FROM raw_material_movements WHERE reference_id = ?').run(cfRef);
        const latestStock = await getRawMaterialStock(rm.id);
        await db.prepare(`
          INSERT INTO raw_material_movements (
            movement_type, reference_type, reference_id, raw_material_id, quantity_change, unit, balance_after, manager_name, remarks
          ) VALUES ('OPENING', 'OPENING_STOCK', ?, ?, ?, ?, ?, 'Admin', ?)
        `).run(cfRef, rm.id, curStock, rm.unit || 'KG', Number((latestStock + curStock).toFixed(2)), `FY ${targetYear} Opening Stock from ${sourceYear}`);
        results.rawMaterials++;
      }
    }

    // 6. Finished Goods Closing Stocks
    const fgs = await db.prepare("SELECT * FROM finished_products WHERE status = 'active'").all();
    for (const fg of fgs) {
      const stockRow = await db.prepare(`
        SELECT COALESCE(SUM(quantity_change), 0) as stock
        FROM finished_goods_movements
        WHERE finished_product_id = ? AND date(created_at) <= ?
      `).get(fg.id, closingDate);
      const curStock = Number(stockRow.stock || 0);
      if (curStock > 0) {
        await db.prepare(`
          INSERT INTO opening_balances (
            financial_year, opening_date, entity_type, entity_id, quantity, unit, amount, balance_type, gsm, size, remarks, created_by
          ) VALUES (?, ?, 'FINISHED_GOOD', ?, ?, ?, 0, 'Dr', ?, ?, ?, 'Admin')
          ON CONFLICT (financial_year, entity_type, entity_id) DO UPDATE
          SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, opening_date = EXCLUDED.opening_date, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
        `).run(targetYear, openingDate, fg.id, curStock, fg.unit || 'KG', fg.gsm || null, fg.width_size || null, `Carried forward stock from ${sourceYear}`);

        const cfRef = `OPENING-FG-CF-${targetYear}-${fg.id}`;
        await db.prepare('DELETE FROM finished_goods_movements WHERE reference_id = ?').run(cfRef);
        const latestStock = await getFinishedGoodStock(fg.id);
        await db.prepare(`
          INSERT INTO finished_goods_movements (
            movement_type, reference_type, reference_id, finished_product_id, quantity_change, unit, balance_after, manager_name, remarks
          ) VALUES ('OPENING', 'OPENING_STOCK', ?, ?, ?, ?, ?, 'Admin', ?)
        `).run(cfRef, fg.id, curStock, fg.unit || 'KG', Number((latestStock + curStock).toFixed(2)), `FY ${targetYear} Opening Stock from ${sourceYear}`);
        results.finishedGoods++;
      }
    }

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'CARRY_FORWARD', ?, 'Admin')
    `).run('FINANCIAL_YEAR', targetYear, JSON.stringify({ sourceYear, targetYear, openingDate, results }));

    res.json({
      success: true,
      message: `Carry-forward from ${sourceYear} to ${targetYear} completed safely.`,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// DEBIT & CREDIT NOTES API
// =============================================================
app.get('/api/accounts/debit-credit-notes', async (req, res) => {
  try {
    const { noteType, partyType, partyId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT dcn.*,
             CASE
               WHEN dcn.party_type = 'CUSTOMER' THEN (SELECT name FROM customers WHERE id = dcn.party_id)
               WHEN dcn.party_type = 'SUPPLIER' THEN (SELECT name FROM suppliers WHERE id = dcn.party_id)
               ELSE 'Unknown'
             END as party_name,
             CASE
               WHEN dcn.party_type = 'CUSTOMER' THEN (SELECT gst_number FROM customers WHERE id = dcn.party_id)
               WHEN dcn.party_type = 'SUPPLIER' THEN (SELECT gst_number FROM suppliers WHERE id = dcn.party_id)
               ELSE ''
             END as party_gstin
      FROM debit_credit_notes dcn
      WHERE dcn.is_voided = 0
    `;
    const params = [];
    if (noteType) { query += ' AND dcn.note_type = ?'; params.push(noteType); }
    if (partyType) { query += ' AND dcn.party_type = ?'; params.push(partyType); }
    if (partyId) { query += ' AND dcn.party_id = ?'; params.push(partyId); }
    if (dateFrom) { query += ' AND dcn.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND dcn.date <= ?'; params.push(dateTo); }
    query += ' ORDER BY dcn.date DESC, dcn.id DESC';
    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/debit-credit-notes', requireAdmin, async (req, res) => {
  try {
    const {
      noteType, // 'DEBIT_NOTE' or 'CREDIT_NOTE'
      date,
      partyType, // 'CUSTOMER' or 'SUPPLIER'
      partyId,
      referenceInvoice = '',
      reason = '',
      taxableAmount,
      gstPercent = 18,
      remarks = ''
    } = req.body;

    const numTaxable = Number(taxableAmount);
    if (!noteType || !date || !partyType || !partyId || isNaN(numTaxable) || numTaxable <= 0) {
      return res.status(400).json({ error: 'Valid Note Type, Date, Party Type, Party, and Taxable Amount (>0) are required.' });
    }
    if (!['DEBIT_NOTE', 'CREDIT_NOTE'].includes(noteType)) {
      return res.status(400).json({ error: 'Note Type must be DEBIT_NOTE or CREDIT_NOTE.' });
    }
    if (!['CUSTOMER', 'SUPPLIER'].includes(partyType)) {
      return res.status(400).json({ error: 'Party Type must be CUSTOMER or SUPPLIER.' });
    }

    let partyState = 'Gujarat';
    let partyGstin = '';
    if (partyType === 'CUSTOMER') {
      const c = await db.prepare('SELECT id, name, state, gst_number FROM customers WHERE id = ?').get(partyId);
      if (!c) return res.status(400).json({ error: `Customer ID ${partyId} not found.` });
      partyState = c.state || 'Gujarat';
      partyGstin = c.gst_number || '';
    } else {
      const s = await db.prepare('SELECT id, name, state, gst_number FROM suppliers WHERE id = ?').get(partyId);
      if (!s) return res.status(400).json({ error: `Supplier ID ${partyId} not found.` });
      partyState = s.state || 'Gujarat';
      partyGstin = s.gst_number || '';
    }

    const gstCalc = calculateGstBreakdown({
      taxableAmount: numTaxable,
      gstPercent: Number(gstPercent) || 0,
      partyState,
      partyGstin
    });

    let prefix = '';
    if (partyType === 'CUSTOMER') {
      prefix = noteType === 'DEBIT_NOTE' ? 'CDN' : 'CCN';
    } else {
      prefix = noteType === 'DEBIT_NOTE' ? 'SDN' : 'SCN';
    }

    const code = await getNextCode(prefix, 'debit_credit_notes', 'note_code');

    const info = await db.prepare(`
      INSERT INTO debit_credit_notes (
        note_type, note_code, date, party_type, party_id, reference_invoice, reason,
        taxable_amount, gst_percent, cgst_amount, sgst_amount, igst_amount, total_amount, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Admin')
    `).run(
      noteType, code, date, partyType, Number(partyId), referenceInvoice || null, reason || null,
      gstCalc.taxableAmount, gstCalc.gstPercent, gstCalc.cgstAmount, gstCalc.sgstAmount, gstCalc.igstAmount,
      gstCalc.grandTotal, remarks || null
    );

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by)
      VALUES (?, ?, 'CREATE', ?, 'Admin')
    `).run(noteType, code, JSON.stringify({ noteType, partyType, partyId, code, totalAmount: gstCalc.grandTotal }));

    res.status(201).json({
      id: info.lastInsertRowid,
      note_code: code,
      note_type: noteType,
      party_type: partyType,
      total_amount: gstCalc.grandTotal
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/accounts/debit-credit-notes/:id', requireAdmin, async (req, res) => {
  try {
    const dcn = await db.prepare('SELECT * FROM debit_credit_notes WHERE id = ?').get(req.params.id);
    if (!dcn) return res.status(404).json({ error: 'Note record not found' });
    if (dcn.is_voided) return res.status(400).json({ error: 'Cannot edit a voided note.' });

    const { date, referenceInvoice, reason, taxableAmount, gstPercent, remarks } = req.body;
    const numTaxable = taxableAmount !== undefined ? Number(taxableAmount) : Number(dcn.taxable_amount);
    const numGstPct = gstPercent !== undefined ? Number(gstPercent) : Number(dcn.gst_percent);

    let partyState = 'Gujarat';
    let partyGstin = '';
    if (dcn.party_type === 'CUSTOMER') {
      const c = await db.prepare('SELECT state, gst_number FROM customers WHERE id = ?').get(dcn.party_id);
      partyState = c?.state || 'Gujarat';
      partyGstin = c?.gst_number || '';
    } else {
      const s = await db.prepare('SELECT state, gst_number FROM suppliers WHERE id = ?').get(dcn.party_id);
      partyState = s?.state || 'Gujarat';
      partyGstin = s?.gst_number || '';
    }

    const gstCalc = calculateGstBreakdown({
      taxableAmount: numTaxable,
      gstPercent: numGstPct,
      partyState,
      partyGstin
    });

    await db.prepare(`
      UPDATE debit_credit_notes
      SET date = COALESCE(?, date),
          reference_invoice = COALESCE(?, reference_invoice),
          reason = COALESCE(?, reason),
          taxable_amount = ?,
          gst_percent = ?,
          cgst_amount = ?,
          sgst_amount = ?,
          igst_amount = ?,
          total_amount = ?,
          remarks = COALESCE(?, remarks),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      date ?? null,
      referenceInvoice ?? null,
      reason ?? null,
      gstCalc.taxableAmount,
      gstCalc.gstPercent,
      gstCalc.cgstAmount,
      gstCalc.sgstAmount,
      gstCalc.igstAmount,
      gstCalc.grandTotal,
      remarks ?? null,
      dcn.id
    );

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
      VALUES (?, ?, 'EDIT', ?, ?, 'Admin')
    `).run(dcn.note_type, dcn.note_code, JSON.stringify(dcn), JSON.stringify(req.body));

    res.json({ success: true, total_amount: gstCalc.grandTotal });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/accounts/debit-credit-notes/:id', requireAdmin, async (req, res) => {
  try {
    const dcn = await db.prepare('SELECT * FROM debit_credit_notes WHERE id = ?').get(req.params.id);
    if (!dcn) return res.status(404).json({ error: 'Note record not found' });
    if (dcn.is_voided) return res.status(400).json({ error: 'Note is already voided.' });

    await db.prepare('UPDATE debit_credit_notes SET is_voided = 1 WHERE id = ?').run(dcn.id);

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
      VALUES (?, ?, 'VOID', ?, 'Admin')
    `).run(dcn.note_type, dcn.note_code, JSON.stringify(dcn));

    res.json({ success: true, message: 'Note entry voided.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Customer Statement of Account / Ledger
app.get('/api/accounts/customer-ledger', async (req, res) => {
  try {
    const { customerId, dateFrom, dateTo, financialYear } = req.query;
    if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });

    const cust = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!cust) return res.status(404).json({ error: 'Customer not found' });

    const activeFy = financialYear || await getActiveFinancialYear();
    const opRec = await db.prepare(`
      SELECT * FROM opening_balances
      WHERE entity_type = 'CUSTOMER' AND entity_id = ? AND financial_year = ?
    `).get(customerId, activeFy);

    let baseOpening = 0;
    let isCreditOpening = false;
    let opDate = null;
    let opRemarks = null;

    if (opRec) {
      baseOpening = Number(opRec.amount || 0);
      isCreditOpening = (opRec.balance_type === 'Cr' || opRec.balance_type === 'CREDIT');
      opDate = opRec.opening_date;
      opRemarks = opRec.remarks;
    } else {
      baseOpening = Number(cust.opening_balance || 0);
      isCreditOpening = (cust.opening_balance_type === 'CREDIT' || cust.opening_balance_type === 'Cr');
    }

    let openingBalance = isCreditOpening ? -baseOpening : baseOpening;

    // Add prior transactions before dateFrom
    if (dateFrom) {
      const prevSalesRow = await db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM sales
        WHERE customer_id = ? AND date < ? AND is_voided = 0
      `).get(customerId, dateFrom);
      const prevSales = Number(prevSalesRow ? prevSalesRow.total : 0);

      const prevRecRow = await db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE party_type = 'CUSTOMER' AND party_id = ? AND date < ? AND is_voided = 0
      `).get(customerId, dateFrom);
      const prevRec = Number(prevRecRow ? prevRecRow.total : 0);

      const prevDnRow = await db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM debit_credit_notes
        WHERE note_type = 'DEBIT_NOTE' AND party_type = 'CUSTOMER' AND party_id = ? AND date < ? AND is_voided = 0
      `).get(customerId, dateFrom);
      const prevDn = Number(prevDnRow ? prevDnRow.total : 0);

      const prevCnRow = await db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM debit_credit_notes
        WHERE note_type = 'CREDIT_NOTE' AND party_type = 'CUSTOMER' AND party_id = ? AND date < ? AND is_voided = 0
      `).get(customerId, dateFrom);
      const prevCn = Number(prevCnRow ? prevCnRow.total : 0);

      openingBalance = Number((openingBalance + prevSales + prevDn - prevCn - prevRec).toFixed(2));
    }

    // Sales (Debits) in range
    let salesQuery = `
      SELECT s.id, s.date, s.invoice_number as doc_no, s.sale_code, s.quantity_kg, s.rate_per_kg,
             s.total_amount as debit, 0 as credit, s.created_at, s.payment_type, s.manager_name
      FROM sales s
      WHERE s.customer_id = ? AND s.is_voided = 0
    `;
    const salesParams = [customerId];
    if (dateFrom) { salesQuery += ' AND s.date >= ?'; salesParams.push(dateFrom); }
    if (dateTo) { salesQuery += ' AND s.date <= ?'; salesParams.push(dateTo); }

    const rawSalesRows = await db.prepare(salesQuery).all(...salesParams);
    const salesRows = await Promise.all(rawSalesRows.map(async r => {
      const items = await db.prepare(`
        SELECT si.*, fp.product_name
        FROM sales_items si
        JOIN finished_products fp ON si.finished_product_id = fp.id
        WHERE si.sale_id = ?
      `).all(r.id);
      const desc = items.length > 0
        ? items.map(i => `${i.product_name} (${i.quantity} ${i.unit || 'KG'})`).join(', ')
        : `Sales: ${r.quantity_kg?.toLocaleString()} KG @ ₹${r.rate_per_kg}/KG`;

      return {
        id: `sale-${r.id}`,
        date: r.date,
        voucher_no: r.doc_no || r.sale_code,
        doc_no: r.doc_no || r.sale_code,
        type: 'INVOICE',
        transaction_type: 'Sale / Invoice',
        particulars: `${desc} [${r.payment_type || 'Credit'}]`,
        description: `${desc} [${r.payment_type || 'Credit'}]`,
        debit: Number(r.debit.toFixed(2)),
        credit: 0,
        entered_by: r.manager_name || 'Admin',
        created_at: r.created_at
      };
    }));

    // Receipts (Credits) in range
    let payQuery = `
      SELECT p.id, p.date, p.reference_no as doc_no, p.payment_code, p.payment_mode, p.remarks,
             0 as debit, p.amount as credit, p.created_at, COALESCE(p.manager_name, p.created_by, 'Admin') as entered_by
      FROM payments p
      WHERE p.party_type = 'CUSTOMER' AND p.party_id = ? AND p.is_voided = 0
    `;
    const payParams = [customerId];
    if (dateFrom) { payQuery += ' AND p.date >= ?'; payParams.push(dateFrom); }
    if (dateTo) { payQuery += ' AND p.date <= ?'; payParams.push(dateTo); }

    const payRows = (await db.prepare(payQuery).all(...payParams)).map(r => ({
      id: `pay-${r.id}`,
      date: r.date,
      voucher_no: r.doc_no || r.payment_code,
      doc_no: r.doc_no || r.payment_code,
      type: 'RECEIPT',
      transaction_type: 'Customer Receipt',
      particulars: `Receipt (${r.payment_mode || 'Bank'}) ${r.remarks ? `- ${r.remarks}` : ''}`,
      description: `Receipt (${r.payment_mode || 'Bank'}) ${r.remarks ? `- ${r.remarks}` : ''}`,
      debit: 0,
      credit: Number(r.credit.toFixed(2)),
      entered_by: r.entered_by || 'Admin',
      created_at: r.created_at
    }));

    // Customer Debit Notes (Debits) in range
    let dnQuery = `
      SELECT d.id, d.date, d.note_code as doc_no, d.reference_invoice, d.reason,
             d.total_amount as debit, 0 as credit, d.created_at, d.created_by
      FROM debit_credit_notes d
      WHERE d.note_type = 'DEBIT_NOTE' AND d.party_type = 'CUSTOMER' AND d.party_id = ? AND d.is_voided = 0
    `;
    const dnParams = [customerId];
    if (dateFrom) { dnQuery += ' AND d.date >= ?'; dnParams.push(dateFrom); }
    if (dateTo) { dnQuery += ' AND d.date <= ?'; dnParams.push(dateTo); }

    const dnRows = (await db.prepare(dnQuery).all(...dnParams)).map(r => ({
      id: `dn-${r.id}`,
      date: r.date,
      voucher_no: r.doc_no,
      doc_no: r.doc_no,
      type: 'DEBIT_NOTE',
      transaction_type: 'Customer Debit Note',
      particulars: `Debit Note (${r.reason || 'Rate Diff/Charge'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      description: `Debit Note (${r.reason || 'Rate Diff/Charge'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      debit: Number(r.debit.toFixed(2)),
      credit: 0,
      entered_by: r.created_by || 'Admin',
      created_at: r.created_at
    }));

    // Customer Credit Notes (Credits) in range
    let cnQuery = `
      SELECT d.id, d.date, d.note_code as doc_no, d.reference_invoice, d.reason,
             0 as debit, d.total_amount as credit, d.created_at, d.created_by
      FROM debit_credit_notes d
      WHERE d.note_type = 'CREDIT_NOTE' AND d.party_type = 'CUSTOMER' AND d.party_id = ? AND d.is_voided = 0
    `;
    const cnParams = [customerId];
    if (dateFrom) { cnQuery += ' AND d.date >= ?'; cnParams.push(dateFrom); }
    if (dateTo) { cnQuery += ' AND d.date <= ?'; cnParams.push(dateTo); }

    const cnRows = (await db.prepare(cnQuery).all(...cnParams)).map(r => ({
      id: `cn-${r.id}`,
      date: r.date,
      voucher_no: r.doc_no,
      doc_no: r.doc_no,
      type: 'CREDIT_NOTE',
      transaction_type: 'Customer Credit Note',
      particulars: `Credit Note (${r.reason || 'Sales Return/Discount'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      description: `Credit Note (${r.reason || 'Sales Return/Discount'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      debit: 0,
      credit: Number(r.credit.toFixed(2)),
      entered_by: r.created_by || 'Admin',
      created_at: r.created_at
    }));

    const allEntries = [...salesRows, ...payRows, ...dnRows, ...cnRows].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.created_at.localeCompare(b.created_at);
    });

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const ledger = allEntries.map(e => {
      totalDebit += e.debit;
      totalCredit += e.credit;
      runningBalance = Number((runningBalance + e.debit - e.credit).toFixed(2));
      return {
        ...e,
        balance: runningBalance
      };
    });

    res.json({
      customer: cust,
      openingBalance,
      transactions: ledger,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      closingBalance: runningBalance,
      balanceType: runningBalance > 0 ? 'RECEIVABLE' : (runningBalance < 0 ? 'ADVANCE' : 'CLEAR')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supplier Statement of Account / Ledger
app.get('/api/accounts/supplier-ledger', async (req, res) => {
  try {
    const { supplierId, dateFrom, dateTo, financialYear } = req.query;
    if (!supplierId) return res.status(400).json({ error: 'Supplier ID is required' });

    const supp = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supp) return res.status(404).json({ error: 'Supplier not found' });

    const activeFy = financialYear || await getActiveFinancialYear();
    const opRec = await db.prepare(`
      SELECT * FROM opening_balances
      WHERE entity_type = 'SUPPLIER' AND entity_id = ? AND financial_year = ?
    `).get(supplierId, activeFy);

    let baseOpening = 0;
    let isDebitOpening = false;
    if (opRec) {
      baseOpening = Number(opRec.amount || 0);
      isDebitOpening = (opRec.balance_type === 'Dr' || opRec.balance_type === 'DEBIT');
    } else {
      baseOpening = Number(supp.opening_balance || 0);
      isDebitOpening = (supp.opening_balance_type === 'DEBIT' || supp.opening_balance_type === 'Dr');
    }

    let openingBalance = isDebitOpening ? -baseOpening : baseOpening;

    // Prior transactions before dateFrom
    if (dateFrom) {
      const prevPurchasesRow = await db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM raw_material_purchases
        WHERE supplier_id = ? AND date < ? AND is_voided = 0
      `).get(supplierId, dateFrom);
      const prevPurchases = Number(prevPurchasesRow ? prevPurchasesRow.total : 0);

      const prevPaymentsRow = await db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE party_type = 'SUPPLIER' AND party_id = ? AND date < ? AND is_voided = 0
      `).get(supplierId, dateFrom);
      const prevPayments = Number(prevPaymentsRow ? prevPaymentsRow.total : 0);

      const prevCnRow = await db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM debit_credit_notes
        WHERE note_type = 'CREDIT_NOTE' AND party_type = 'SUPPLIER' AND party_id = ? AND date < ? AND is_voided = 0
      `).get(supplierId, dateFrom);
      const prevCn = Number(prevCnRow ? prevCnRow.total : 0);

      const prevDnRow = await db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM debit_credit_notes
        WHERE note_type = 'DEBIT_NOTE' AND party_type = 'SUPPLIER' AND party_id = ? AND date < ? AND is_voided = 0
      `).get(supplierId, dateFrom);
      const prevDn = Number(prevDnRow ? prevDnRow.total : 0);

      openingBalance = Number((openingBalance + prevPurchases + prevCn - prevDn - prevPayments).toFixed(2));
    }

    // Purchases (Credits) in range
    let purQuery = `
      SELECT p.id, p.date, p.invoice_number as doc_no, p.purchase_code, p.quantity_kg, p.rate_per_kg,
             0 as debit, p.total_amount as credit, p.created_at, p.payment_mode, p.manager_name
      FROM raw_material_purchases p
      WHERE p.supplier_id = ? AND p.is_voided = 0
    `;
    const purParams = [supplierId];
    if (dateFrom) { purQuery += ' AND p.date >= ?'; purParams.push(dateFrom); }
    if (dateTo) { purQuery += ' AND p.date <= ?'; purParams.push(dateTo); }

    const rawPurRows = await db.prepare(purQuery).all(...purParams);
    const purRows = await Promise.all(rawPurRows.map(async r => {
      const items = await db.prepare(`
        SELECT pi.*, rm.name as raw_material_name
        FROM purchase_items pi
        JOIN raw_materials rm ON pi.raw_material_id = rm.id
        WHERE pi.purchase_id = ?
      `).all(r.id);
      const desc = items.length > 0
        ? items.map(i => `${i.raw_material_name} (${i.quantity} ${i.unit || 'KG'})`).join(', ')
        : `Purchase: ${r.quantity_kg?.toLocaleString()} KG @ ₹${r.rate_per_kg}/KG`;

      return {
        id: `pur-${r.id}`,
        date: r.date,
        voucher_no: r.doc_no || r.purchase_code,
        doc_no: r.doc_no || r.purchase_code,
        type: 'BILL',
        transaction_type: 'Purchase / Bill',
        particulars: `${desc} [${r.payment_mode || 'Credit'}]`,
        description: `${desc} [${r.payment_mode || 'Credit'}]`,
        debit: 0,
        credit: Number(r.credit.toFixed(2)),
        entered_by: r.manager_name || 'Admin',
        created_at: r.created_at
      };
    }));

    // Payments (Debits) in range
    let payQuery = `
      SELECT p.id, p.date, p.reference_no as doc_no, p.payment_code, p.payment_mode, p.remarks,
             p.amount as debit, 0 as credit, p.created_at, COALESCE(p.manager_name, p.created_by, 'Admin') as entered_by
      FROM payments p
      WHERE p.party_type = 'SUPPLIER' AND p.party_id = ? AND p.is_voided = 0
    `;
    const payParams = [supplierId];
    if (dateFrom) { payQuery += ' AND p.date >= ?'; payParams.push(dateFrom); }
    if (dateTo) { payQuery += ' AND p.date <= ?'; payParams.push(dateTo); }

    const payRows = (await db.prepare(payQuery).all(...payParams)).map(r => ({
      id: `pay-${r.id}`,
      date: r.date,
      voucher_no: r.doc_no || r.payment_code,
      doc_no: r.doc_no || r.payment_code,
      type: 'PAYMENT',
      transaction_type: 'Supplier Payment',
      particulars: `Payment (${r.payment_mode || 'Bank'}) ${r.remarks ? `- ${r.remarks}` : ''}`,
      description: `Payment (${r.payment_mode || 'Bank'}) ${r.remarks ? `- ${r.remarks}` : ''}`,
      debit: Number(r.debit.toFixed(2)),
      credit: 0,
      entered_by: r.entered_by || 'Admin',
      created_at: r.created_at
    }));

    // Supplier Credit Notes (Credits) in range
    let cnQuery = `
      SELECT d.id, d.date, d.note_code as doc_no, d.reference_invoice, d.reason,
             0 as debit, d.total_amount as credit, d.created_at, d.created_by
      FROM debit_credit_notes d
      WHERE d.note_type = 'CREDIT_NOTE' AND d.party_type = 'SUPPLIER' AND d.party_id = ? AND d.is_voided = 0
    `;
    const cnParams = [supplierId];
    if (dateFrom) { cnQuery += ' AND d.date >= ?'; cnParams.push(dateFrom); }
    if (dateTo) { cnQuery += ' AND d.date <= ?'; cnParams.push(dateTo); }

    const cnRows = (await db.prepare(cnQuery).all(...cnParams)).map(r => ({
      id: `cn-${r.id}`,
      date: r.date,
      voucher_no: r.doc_no,
      doc_no: r.doc_no,
      type: 'CREDIT_NOTE',
      transaction_type: 'Supplier Credit Note',
      particulars: `Credit Note (${r.reason || 'Price Increase/Charge'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      description: `Credit Note (${r.reason || 'Price Increase/Charge'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      debit: 0,
      credit: Number(r.credit.toFixed(2)),
      entered_by: r.created_by || 'Admin',
      created_at: r.created_at
    }));

    // Supplier Debit Notes (Debits) in range
    let dnQuery = `
      SELECT d.id, d.date, d.note_code as doc_no, d.reference_invoice, d.reason,
             d.total_amount as debit, 0 as credit, d.created_at, d.created_by
      FROM debit_credit_notes d
      WHERE d.note_type = 'DEBIT_NOTE' AND d.party_type = 'SUPPLIER' AND d.party_id = ? AND d.is_voided = 0
    `;
    const dnParams = [supplierId];
    if (dateFrom) { dnQuery += ' AND d.date >= ?'; dnParams.push(dateFrom); }
    if (dateTo) { dnQuery += ' AND d.date <= ?'; dnParams.push(dateTo); }

    const dnRows = (await db.prepare(dnQuery).all(...dnParams)).map(r => ({
      id: `dn-${r.id}`,
      date: r.date,
      voucher_no: r.doc_no,
      doc_no: r.doc_no,
      type: 'DEBIT_NOTE',
      transaction_type: 'Supplier Debit Note',
      particulars: `Debit Note (${r.reason || 'Purchase Return/Discount'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      description: `Debit Note (${r.reason || 'Purchase Return/Discount'}) ${r.reference_invoice ? `[Ref: ${r.reference_invoice}]` : ''}`,
      debit: Number(r.debit.toFixed(2)),
      credit: 0,
      entered_by: r.created_by || 'Admin',
      created_at: r.created_at
    }));

    const allEntries = [...purRows, ...payRows, ...cnRows, ...dnRows].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.created_at.localeCompare(b.created_at);
    });

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const ledger = allEntries.map(e => {
      totalDebit += e.debit;
      totalCredit += e.credit;
      runningBalance = Number((runningBalance + e.credit - e.debit).toFixed(2));
      return {
        ...e,
        balance: runningBalance
      };
    });

    res.json({
      supplier: supp,
      openingBalance,
      transactions: ledger,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      closingBalance: runningBalance,
      balanceType: runningBalance > 0 ? 'PAYABLE' : (runningBalance < 0 ? 'ADVANCE' : 'CLEAR')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer Outstanding Summary
app.get('/api/accounts/customer-outstanding', async (req, res) => {
  try {
    const { financialYear } = req.query;
    const activeFy = financialYear || await getActiveFinancialYear();
    const customers = await db.prepare("SELECT * FROM customers WHERE status = 'active' ORDER BY name ASC").all();

    const rows = await Promise.all(customers.map(async c => {
      const opRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'CUSTOMER' AND entity_id = ? AND financial_year = ?").get(c.id, activeFy);
      let opening = 0;
      if (opRec) {
        opening = opRec.balance_type === 'Cr' ? -Number(opRec.amount) : Number(opRec.amount);
      } else {
        const baseOpening = Number(c.opening_balance || 0);
        const isCredit = (c.opening_balance_type === 'CREDIT' || c.opening_balance_type === 'Cr');
        opening = isCredit ? -baseOpening : baseOpening;
      }

      const salesRow = (await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE customer_id = ? AND is_voided = 0').get(c.id)) || {};
      const recRow = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'CUSTOMER' AND party_id = ? AND is_voided = 0").get(c.id)) || {};
      const dnRow = (await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'DEBIT_NOTE' AND party_type = 'CUSTOMER' AND party_id = ? AND is_voided = 0").get(c.id)) || {};
      const cnRow = (await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'CREDIT_NOTE' AND party_type = 'CUSTOMER' AND party_id = ? AND is_voided = 0").get(c.id)) || {};

      const totalSalesWithNotes = Number((Number(salesRow.total || 0) + Number(dnRow.total || 0) - Number(cnRow.total || 0)).toFixed(2));
      const receiptsSum = Number(recRow.total || 0);
      const netOutstanding = Number((opening + totalSalesWithNotes - receiptsSum).toFixed(2));

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
        totalSales: totalSalesWithNotes,
        totalReceipts: Number(receiptsSum.toFixed(2)),
        netOutstanding,
        status: netOutstanding > 0 ? 'DUE' : (netOutstanding < 0 ? 'ADVANCE' : 'CLEAR')
      };
    }));

    const totalReceivable = rows.filter(r => r.netOutstanding > 0).reduce((acc, r) => acc + r.netOutstanding, 0);
    const totalAdvance = rows.filter(r => r.netOutstanding < 0).reduce((acc, r) => acc + Math.abs(r.netOutstanding), 0);
    const totalSales = rows.reduce((acc, r) => acc + r.totalSales, 0);
    const totalReceipts = rows.reduce((acc, r) => acc + r.totalReceipts, 0);

    res.json({
      rows,
      summary: {
        totalReceivable: Number(totalReceivable.toFixed(2)),
        totalAdvance: Number(totalAdvance.toFixed(2)),
        netReceivable: Number((totalReceivable - totalAdvance).toFixed(2)),
        totalSales: Number(totalSales.toFixed(2)),
        totalReceipts: Number(totalReceipts.toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supplier Outstanding Summary
app.get('/api/accounts/supplier-outstanding', async (req, res) => {
  try {
    const { financialYear } = req.query;
    const activeFy = financialYear || await getActiveFinancialYear();
    const suppliers = await db.prepare("SELECT * FROM suppliers WHERE status = 'active' ORDER BY name ASC").all();

    const rows = await Promise.all(suppliers.map(async s => {
      const opRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'SUPPLIER' AND entity_id = ? AND financial_year = ?").get(s.id, activeFy);
      let opening = 0;
      if (opRec) {
        opening = opRec.balance_type === 'Dr' ? -Number(opRec.amount) : Number(opRec.amount);
      } else {
        const baseOpening = Number(s.opening_balance || 0);
        const isDebit = (s.opening_balance_type === 'DEBIT' || s.opening_balance_type === 'Dr');
        opening = isDebit ? -baseOpening : baseOpening;
      }

      const purRow = (await db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE supplier_id = ? AND is_voided = 0').get(s.id)) || {};
      const payRow = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE party_type = 'SUPPLIER' AND party_id = ? AND is_voided = 0").get(s.id)) || {};
      const cnRow = (await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'CREDIT_NOTE' AND party_type = 'SUPPLIER' AND party_id = ? AND is_voided = 0").get(s.id)) || {};
      const dnRow = (await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM debit_credit_notes WHERE note_type = 'DEBIT_NOTE' AND party_type = 'SUPPLIER' AND party_id = ? AND is_voided = 0").get(s.id)) || {};

      const totalPurchasesWithNotes = Number((Number(purRow.total || 0) + Number(cnRow.total || 0) - Number(dnRow.total || 0)).toFixed(2));
      const paymentsSum = Number(payRow.total || 0);
      const netPayable = Number((opening + totalPurchasesWithNotes - paymentsSum).toFixed(2));

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
        totalPurchases: totalPurchasesWithNotes,
        totalPayments: Number(paymentsSum.toFixed(2)),
        netPayable,
        status: netPayable > 0 ? 'PAYABLE' : (netPayable < 0 ? 'ADVANCE' : 'CLEAR')
      };
    }));

    const totalPayable = rows.filter(r => r.netPayable > 0).reduce((acc, r) => acc + r.netPayable, 0);
    const totalAdvance = rows.filter(r => r.netPayable < 0).reduce((acc, r) => acc + Math.abs(r.netPayable), 0);
    const totalPurchases = rows.reduce((acc, r) => acc + r.totalPurchases, 0);
    const totalPayments = rows.reduce((acc, r) => acc + r.totalPayments, 0);

    res.json({
      rows,
      summary: {
        totalPayable: Number(totalPayable.toFixed(2)),
        totalAdvance: Number(totalAdvance.toFixed(2)),
        netPayable: Number((totalPayable - totalAdvance).toFixed(2)),
        totalPurchases: Number(totalPurchases.toFixed(2)),
        totalPayments: Number(totalPayments.toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete Cash Book / Ledger (Supports both /cash-ledger and /cash-book aliases)
app.get(['/api/accounts/cash-ledger', '/api/accounts/cash-book'], async (req, res) => {
  try {
    const { dateFrom, dateTo, financialYear } = req.query;
    const activeFy = financialYear || await getActiveFinancialYear();

    const cashOpRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'CASH' AND financial_year = ?").get(activeFy);
    let openingCash = 0;
    if (cashOpRec) {
      openingCash = cashOpRec.balance_type === 'Cr' ? -Number(cashOpRec.amount) : Number(cashOpRec.amount);
    }

    if (dateFrom) {
      const prevRecRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_mode = 'Cash' AND party_type IN ('CUSTOMER', 'INCOME') AND date < ? AND is_voided = 0").get(dateFrom);
      const prevPayRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_mode = 'Cash' AND party_type IN ('SUPPLIER', 'EXPENSE') AND date < ? AND is_voided = 0").get(dateFrom);
      const prevSaleRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE payment_type = 'Cash' AND date < ? AND is_voided = 0").get(dateFrom);
      const prevPurRow = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM raw_material_purchases WHERE payment_mode = 'Cash' AND date < ? AND is_voided = 0").get(dateFrom);

      openingCash = Number((openingCash + Number(prevRecRow.total) + Number(prevSaleRow.total) - Number(prevPayRow.total) - Number(prevPurRow.total)).toFixed(2));
    }

    // Inflows: Cash Receipts + Non-duplicate Cash Sales + Cash Side Incomes
    let recQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.amount, c.name as party_name, p.remarks, p.created_at, p.party_id FROM payments p JOIN customers c ON p.party_id = c.id WHERE p.party_type = 'CUSTOMER' AND p.payment_mode = 'Cash' AND p.is_voided = 0";
    const recParams = [];
    if (dateFrom) { recQuery += ' AND p.date >= ?'; recParams.push(dateFrom); }
    if (dateTo) { recQuery += ' AND p.date <= ?'; recParams.push(dateTo); }
    const rawRecs = await db.prepare(recQuery).all(...recParams);

    // Cash Side Incomes
    let incQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.amount, eh.name as party_name, p.remarks, p.created_at, p.party_id FROM payments p JOIN expense_heads eh ON p.party_id = eh.id WHERE p.party_type = 'INCOME' AND p.payment_mode = 'Cash' AND p.is_voided = 0";
    const incParams = [];
    if (dateFrom) { incQuery += ' AND p.date >= ?'; incParams.push(dateFrom); }
    if (dateTo) { incQuery += ' AND p.date <= ?'; incParams.push(dateTo); }
    const rawIncs = await db.prepare(incQuery).all(...incParams);

    const cashIncomes = rawIncs.map(p => ({
      id: `cinc-${p.id}`,
      date: p.date,
      doc_no: p.doc_no || p.payment_code,
      type: 'INFLOW',
      category: 'Side / Other Income',
      description: `Income: ${p.party_name}${p.remarks ? ` (${p.remarks})` : ''}`,
      inflow: Number(Number(p.amount).toFixed(2)),
      outflow: 0,
      created_at: p.created_at
    }));

    let salesQuery = "SELECT id, date, invoice_number, invoice_number as doc_no, sale_code, total_amount as amount, customer_id, 'CASH_SALE' as trans_type, 'Cash Sale' as description, created_at FROM sales WHERE payment_type = 'Cash' AND is_voided = 0";
    const salesParams = [];
    if (dateFrom) { salesQuery += ' AND date >= ?'; salesParams.push(dateFrom); }
    if (dateTo) { salesQuery += ' AND date <= ?'; salesParams.push(dateTo); }
    const rawSales = await db.prepare(salesQuery).all(...salesParams);

    const matchedSaleIds = new Set();
    const cashReceipts = rawRecs.map(p => {
      const matchingSale = rawSales.find(s =>
        !matchedSaleIds.has(s.id) && (
          (p.reference_no && (p.reference_no.trim().toLowerCase() === (s.invoice_number || '').trim().toLowerCase() || p.reference_no.trim().toLowerCase() === (s.sale_code || '').trim().toLowerCase())) ||
          (Number(p.party_id) === Number(s.customer_id) && Math.abs(Number(p.amount) - Number(s.amount)) < 0.01 && p.date === s.date)
        )
      );
      if (matchingSale) {
        matchedSaleIds.add(matchingSale.id);
      }
      return {
        id: `crec-${p.id}`,
        date: p.date,
        doc_no: p.doc_no || p.payment_code,
        type: 'INFLOW',
        category: 'Customer Receipt',
        description: `Receipt from ${p.party_name}${p.remarks ? ` (${p.remarks})` : ''}`,
        inflow: Number(Number(p.amount).toFixed(2)),
        outflow: 0,
        created_at: p.created_at
      };
    });

    const cashSales = rawSales
      .filter(s => !matchedSaleIds.has(s.id))
      .map(r => ({
        id: `csale-${r.id}`,
        date: r.date,
        doc_no: r.doc_no || r.sale_code,
        type: 'INFLOW',
        category: 'Cash Sale',
        description: r.description,
        inflow: Number(Number(r.amount).toFixed(2)),
        outflow: 0,
        created_at: r.created_at
      }));

    // Outflows: Cash Supplier Payments + Non-duplicate Cash Purchases + Cash Expenses
    let payQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.amount, s.name as party_name, p.remarks, p.created_at, p.party_id FROM payments p JOIN suppliers s ON p.party_id = s.id WHERE p.party_type = 'SUPPLIER' AND p.payment_mode = 'Cash' AND p.is_voided = 0";
    const payParams = [];
    if (dateFrom) { payQuery += ' AND p.date >= ?'; payParams.push(dateFrom); }
    if (dateTo) { payQuery += ' AND p.date <= ?'; payParams.push(dateTo); }
    const rawPays = await db.prepare(payQuery).all(...payParams);

    // Cash Expenses
    let expQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.amount, eh.name as party_name, p.remarks, p.created_at, p.party_id FROM payments p JOIN expense_heads eh ON p.party_id = eh.id WHERE p.party_type = 'EXPENSE' AND p.payment_mode = 'Cash' AND p.is_voided = 0";
    const expParams = [];
    if (dateFrom) { expQuery += ' AND p.date >= ?'; expParams.push(dateFrom); }
    if (dateTo) { expQuery += ' AND p.date <= ?'; expParams.push(dateTo); }
    const rawExps = await db.prepare(expQuery).all(...expParams);

    const cashExpenses = rawExps.map(p => ({
      id: `cexp-${p.id}`,
      date: p.date,
      doc_no: p.doc_no || p.payment_code,
      type: 'OUTFLOW',
      category: 'Expense Payment',
      description: `Expense: ${p.party_name}${p.remarks ? ` (${p.remarks})` : ''}`,
      inflow: 0,
      outflow: Number(Number(p.amount).toFixed(2)),
      created_at: p.created_at
    }));

    let purQuery = "SELECT id, date, invoice_number, invoice_number as doc_no, purchase_code, total_amount as amount, supplier_id, 'CASH_PURCHASE' as trans_type, 'Cash RM Purchase' as description, created_at FROM raw_material_purchases WHERE payment_mode = 'Cash' AND is_voided = 0";
    const purParams = [];
    if (dateFrom) { purQuery += ' AND date >= ?'; purParams.push(dateFrom); }
    if (dateTo) { purQuery += ' AND date <= ?'; purParams.push(dateTo); }
    const rawPurs = await db.prepare(purQuery).all(...purParams);

    const matchedPurIds = new Set();
    const cashPayments = rawPays.map(p => {
      const matchingPur = rawPurs.find(pur =>
        !matchedPurIds.has(pur.id) && (
          (p.reference_no && (p.reference_no.trim().toLowerCase() === (pur.invoice_number || '').trim().toLowerCase() || p.reference_no.trim().toLowerCase() === (pur.purchase_code || '').trim().toLowerCase())) ||
          (Number(p.party_id) === Number(pur.supplier_id) && Math.abs(Number(p.amount) - Number(pur.amount)) < 0.01 && p.date === pur.date)
        )
      );
      if (matchingPur) {
        matchedPurIds.add(matchingPur.id);
      }
      return {
        id: `cpay-${p.id}`,
        date: p.date,
        doc_no: p.doc_no || p.payment_code,
        type: 'OUTFLOW',
        category: 'Supplier Payment',
        description: `Payment to ${p.party_name}${p.remarks ? ` (${p.remarks})` : ''}`,
        inflow: 0,
        outflow: Number(Number(p.amount).toFixed(2)),
        created_at: p.created_at
      };
    });

    const cashPurchases = rawPurs
      .filter(pur => !matchedPurIds.has(pur.id))
      .map(r => ({
        id: `cpur-${r.id}`,
        date: r.date,
        doc_no: r.doc_no || r.purchase_code,
        type: 'OUTFLOW',
        category: 'Cash Purchase',
        description: r.description,
        inflow: 0,
        outflow: Number(Number(r.amount).toFixed(2)),
        created_at: r.created_at
      }));

    const allCash = [...cashSales, ...cashReceipts, ...cashIncomes, ...cashPurchases, ...cashPayments, ...cashExpenses].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.created_at.localeCompare(b.created_at);
    });

    let runningBalance = openingCash;
    let totalInflow = 0;
    let totalOutflow = 0;

    const ledger = allCash.map(c => {
      totalInflow += c.inflow;
      totalOutflow += c.outflow;
      runningBalance = Number((runningBalance + c.inflow - c.outflow).toFixed(2));
      return {
        ...c,
        balance: runningBalance
      };
    });

    res.json({
      openingBalance: openingCash,
      transactions: ledger,
      summary: {
        openingCash,
        totalInflow: Number(totalInflow.toFixed(2)),
        totalOutflow: Number(totalOutflow.toFixed(2)),
        netCashInHand: runningBalance
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete Bank Book / Ledger (Supports bank-wise selection and transfers)
app.get('/api/accounts/bank-ledger', async (req, res) => {
  try {
    const { dateFrom, dateTo, bankAccountId, financialYear } = req.query;
    const activeFy = financialYear || await getActiveFinancialYear();

    let openingBank = 0;
    let selectedBank = null;

    if (bankAccountId) {
      selectedBank = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(bankAccountId);
      if (selectedBank) {
        const opRec = await db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'BANK' AND entity_id = ? AND financial_year = ?").get(bankAccountId, activeFy);
        if (opRec) {
          openingBank = opRec.balance_type === 'Cr' ? -Number(opRec.amount) : Number(opRec.amount);
        } else {
          openingBank = selectedBank.opening_balance_type === 'Cr' ? -Number(selectedBank.opening_balance || 0) : Number(selectedBank.opening_balance || 0);
        }
      }
    } else {
      const opRows = await db.prepare("SELECT amount, balance_type FROM opening_balances WHERE entity_type = 'BANK' AND financial_year = ?").all(activeFy);
      if (opRows.length > 0) {
        openingBank = opRows.reduce((sum, r) => sum + (r.balance_type === 'Cr' ? -Number(r.amount) : Number(r.amount)), 0);
      } else {
        const allBanks = await db.prepare("SELECT opening_balance, opening_balance_type FROM bank_accounts WHERE status = 'active'").all();
        openingBank = allBanks.reduce((sum, b) => sum + (b.opening_balance_type === 'Cr' ? -Number(b.opening_balance || 0) : Number(b.opening_balance || 0)), 0);
      }
    }

    if (dateFrom) {
      let prevRecQ = "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_mode != 'Cash' AND party_type IN ('CUSTOMER', 'INCOME') AND date < ? AND is_voided = 0";
      const prevRecP = [dateFrom];
      if (bankAccountId) { prevRecQ += ' AND bank_account_id = ?'; prevRecP.push(bankAccountId); }
      const prevRecRow = await db.prepare(prevRecQ).get(...prevRecP);

      let prevPayQ = "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_mode != 'Cash' AND party_type IN ('SUPPLIER', 'EXPENSE') AND date < ? AND is_voided = 0";
      const prevPayP = [dateFrom];
      if (bankAccountId) { prevPayQ += ' AND bank_account_id = ?'; prevPayP.push(bankAccountId); }
      const prevPayRow = await db.prepare(prevPayQ).get(...prevPayP);

      let prevTfIn = 0;
      let prevTfOut = 0;
      if (bankAccountId) {
        const rIn = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM bank_transfers WHERE to_bank_id = ? AND date < ? AND is_voided = 0').get(bankAccountId, dateFrom);
        const rOut = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM bank_transfers WHERE from_bank_id = ? AND date < ? AND is_voided = 0').get(bankAccountId, dateFrom);
        prevTfIn = Number(rIn?.total || 0);
        prevTfOut = Number(rOut?.total || 0);
      }

      openingBank = Number((openingBank + Number(prevRecRow?.total || 0) - Number(prevPayRow?.total || 0) + prevTfIn - prevTfOut).toFixed(2));
    }

    // Inflows: Bank Receipts + Bank Side Incomes
    let recQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.payment_mode, p.amount, c.name as party_name, p.remarks, p.created_at, p.party_id, p.bank_account_id FROM payments p JOIN customers c ON p.party_id = c.id WHERE p.party_type = 'CUSTOMER' AND p.payment_mode != 'Cash' AND p.is_voided = 0";
    const recParams = [];
    if (bankAccountId) { recQuery += ' AND p.bank_account_id = ?'; recParams.push(bankAccountId); }
    if (dateFrom) { recQuery += ' AND p.date >= ?'; recParams.push(dateFrom); }
    if (dateTo) { recQuery += ' AND p.date <= ?'; recParams.push(dateTo); }
    const rawBankRecs = await db.prepare(recQuery).all(...recParams);

    const bankReceipts = rawBankRecs.map(r => ({
      id: `brec-${r.id}`,
      date: r.date,
      doc_no: r.doc_no || r.payment_code,
      type: 'INFLOW',
      category: 'Customer Receipt',
      description: `Receipt from ${r.party_name}${r.remarks ? ` (${r.remarks})` : ''}`,
      mode: r.payment_mode || 'Bank',
      inflow: Number(Number(r.amount).toFixed(2)),
      outflow: 0,
      created_at: r.created_at
    }));

    // Bank Side Incomes
    let incQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.payment_mode, p.amount, eh.name as party_name, p.remarks, p.created_at, p.party_id, p.bank_account_id FROM payments p JOIN expense_heads eh ON p.party_id = eh.id WHERE p.party_type = 'INCOME' AND p.payment_mode != 'Cash' AND p.is_voided = 0";
    const incParams = [];
    if (bankAccountId) { incQuery += ' AND p.bank_account_id = ?'; incParams.push(bankAccountId); }
    if (dateFrom) { incQuery += ' AND p.date >= ?'; incParams.push(dateFrom); }
    if (dateTo) { incQuery += ' AND p.date <= ?'; incParams.push(dateTo); }
    const rawBankIncs = await db.prepare(incQuery).all(...incParams);

    const bankIncomes = rawBankIncs.map(r => ({
      id: `binc-${r.id}`,
      date: r.date,
      doc_no: r.doc_no || r.payment_code,
      type: 'INFLOW',
      category: 'Side / Other Income',
      description: `Income: ${r.party_name}${r.remarks ? ` (${r.remarks})` : ''}`,
      mode: r.payment_mode || 'Bank',
      inflow: Number(Number(r.amount).toFixed(2)),
      outflow: 0,
      created_at: r.created_at
    }));

    // Outflows: Bank Supplier Payments + Bank Expenses
    let payQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.payment_mode, p.amount, s.name as party_name, p.remarks, p.created_at, p.party_id, p.bank_account_id FROM payments p JOIN suppliers s ON p.party_id = s.id WHERE p.party_type = 'SUPPLIER' AND p.payment_mode != 'Cash' AND p.is_voided = 0";
    const payParams = [];
    if (bankAccountId) { payQuery += ' AND p.bank_account_id = ?'; payParams.push(bankAccountId); }
    if (dateFrom) { payQuery += ' AND p.date >= ?'; payParams.push(dateFrom); }
    if (dateTo) { payQuery += ' AND p.date <= ?'; payParams.push(dateTo); }
    const rawBankPays = await db.prepare(payQuery).all(...payParams);

    const bankPayments = rawBankPays.map(r => ({
      id: `bpay-${r.id}`,
      date: r.date,
      doc_no: r.doc_no || r.payment_code,
      type: 'OUTFLOW',
      category: 'Supplier Payment',
      description: `Payment to ${r.party_name}${r.remarks ? ` (${r.remarks})` : ''}`,
      mode: r.payment_mode || 'Bank',
      inflow: 0,
      outflow: Number(Number(r.amount).toFixed(2)),
      created_at: r.created_at
    }));

    // Bank Expenses
    let expQuery = "SELECT p.id, p.date, p.reference_no, p.reference_no as doc_no, p.payment_code, p.payment_mode, p.amount, eh.name as party_name, p.remarks, p.created_at, p.party_id, p.bank_account_id FROM payments p JOIN expense_heads eh ON p.party_id = eh.id WHERE p.party_type = 'EXPENSE' AND p.payment_mode != 'Cash' AND p.is_voided = 0";
    const expParams = [];
    if (bankAccountId) { expQuery += ' AND p.bank_account_id = ?'; expParams.push(bankAccountId); }
    if (dateFrom) { expQuery += ' AND p.date >= ?'; expParams.push(dateFrom); }
    if (dateTo) { expQuery += ' AND p.date <= ?'; expParams.push(dateTo); }
    const rawBankExps = await db.prepare(expQuery).all(...expParams);

    const bankExpenses = rawBankExps.map(r => ({
      id: `bexp-${r.id}`,
      date: r.date,
      doc_no: r.doc_no || r.payment_code,
      type: 'OUTFLOW',
      category: 'Expense Payment',
      description: `Expense: ${r.party_name}${r.remarks ? ` (${r.remarks})` : ''}`,
      mode: r.payment_mode || 'Bank',
      inflow: 0,
      outflow: Number(Number(r.amount).toFixed(2)),
      created_at: r.created_at
    }));

    // Bank Transfers IN
    let tfInQuery = `
      SELECT bt.*, fb.account_name as from_account_name, fb.bank_name as from_bank_name
      FROM bank_transfers bt
      JOIN bank_accounts fb ON bt.from_bank_id = fb.id
      WHERE bt.is_voided = 0
    `;
    const tfInParams = [];
    if (bankAccountId) { tfInQuery += ' AND bt.to_bank_id = ?'; tfInParams.push(bankAccountId); }
    if (dateFrom) { tfInQuery += ' AND bt.date >= ?'; tfInParams.push(dateFrom); }
    if (dateTo) { tfInQuery += ' AND bt.date <= ?'; tfInParams.push(dateTo); }
    const rawTfIn = bankAccountId ? await db.prepare(tfInQuery).all(...tfInParams) : [];

    const transfersIn = rawTfIn.map(t => ({
      id: `bt-in-${t.id}`,
      date: t.date,
      doc_no: t.transfer_code,
      type: 'INFLOW',
      category: 'Bank Transfer IN',
      description: `Transfer from ${t.from_bank_name} (${t.from_account_name})${t.remarks ? ` - ${t.remarks}` : ''}`,
      mode: 'Bank Transfer',
      inflow: Number(Number(t.amount).toFixed(2)),
      outflow: 0,
      created_at: t.created_at
    }));

    // Bank Transfers OUT
    let tfOutQuery = `
      SELECT bt.*, tb.account_name as to_account_name, tb.bank_name as to_bank_name
      FROM bank_transfers bt
      JOIN bank_accounts tb ON bt.to_bank_id = tb.id
      WHERE bt.is_voided = 0
    `;
    const tfOutParams = [];
    if (bankAccountId) { tfOutQuery += ' AND bt.from_bank_id = ?'; tfOutParams.push(bankAccountId); }
    if (dateFrom) { tfOutQuery += ' AND bt.date >= ?'; tfOutParams.push(dateFrom); }
    if (dateTo) { tfOutQuery += ' AND bt.date <= ?'; tfOutParams.push(dateTo); }
    const rawTfOut = bankAccountId ? await db.prepare(tfOutQuery).all(...tfOutParams) : [];

    const transfersOut = rawTfOut.map(t => ({
      id: `bt-out-${t.id}`,
      date: t.date,
      doc_no: t.transfer_code,
      type: 'OUTFLOW',
      category: 'Bank Transfer OUT',
      description: `Transfer to ${t.to_bank_name} (${t.to_account_name})${t.remarks ? ` - ${t.remarks}` : ''}`,
      mode: 'Bank Transfer',
      inflow: 0,
      outflow: Number(Number(t.amount).toFixed(2)),
      created_at: t.created_at
    }));

    const allBank = [...bankReceipts, ...bankIncomes, ...bankPayments, ...bankExpenses, ...transfersIn, ...transfersOut].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.created_at.localeCompare(b.created_at);
    });

    let runningBalance = openingBank;
    let totalInflow = 0;
    let totalOutflow = 0;

    const ledger = allBank.map(b => {
      totalInflow += b.inflow;
      totalOutflow += b.outflow;
      runningBalance = Number((runningBalance + b.inflow - b.outflow).toFixed(2));
      return {
        ...b,
        balance: runningBalance
      };
    });

    res.json({
      bankAccount: selectedBank,
      openingBalance: openingBank,
      transactions: ledger,
      summary: {
        openingBank,
        totalInflow: Number(totalInflow.toFixed(2)),
        totalOutflow: Number(totalOutflow.toFixed(2)),
        netBankBalance: runningBalance
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments / Receipts List
app.get('/api/accounts/payments', async (req, res) => {
  try {
    const { partyType, partyId, dateFrom, dateTo, paymentMode, bankAccountId } = req.query;
    let query = `
      SELECT p.*,
             ba.bank_name,
             ba.account_name as bank_account_name,
             CASE
               WHEN p.party_type = 'CUSTOMER' THEN (SELECT name FROM customers WHERE id = p.party_id)
               WHEN p.party_type = 'SUPPLIER' THEN (SELECT name FROM suppliers WHERE id = p.party_id)
               WHEN p.party_type IN ('EXPENSE', 'INCOME') THEN (SELECT name FROM expense_heads WHERE id = p.party_id)
               ELSE 'Unknown'
             END AS party_name,
             CASE
               WHEN p.party_type = 'CUSTOMER' THEN (SELECT gst_number FROM customers WHERE id = p.party_id)
               WHEN p.party_type = 'SUPPLIER' THEN (SELECT gst_number FROM suppliers WHERE id = p.party_id)
               WHEN p.party_type IN ('EXPENSE', 'INCOME') THEN (SELECT category FROM expense_heads WHERE id = p.party_id)
               ELSE ''
             END AS party_gstin
      FROM payments p
      LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
      WHERE p.is_voided = 0
    `;
    const params = [];
    if (partyType) { query += ' AND p.party_type = ?'; params.push(partyType); }
    if (partyId) { query += ' AND p.party_id = ?'; params.push(partyId); }
    if (paymentMode) { query += ' AND p.payment_mode = ?'; params.push(paymentMode); }
    if (bankAccountId) { query += ' AND p.bank_account_id = ?'; params.push(bankAccountId); }
    if (dateFrom) { query += ' AND p.date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND p.date <= ?'; params.push(dateTo); }

    query += ' ORDER BY p.date DESC, p.id DESC';
    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payment / Receipt Entry (Supports Manager role & Admin role)
app.post('/api/accounts/payments', checkManagerModule('payments', 'Receipts & Payments'), async (req, res) => {
  try {
    const {
      date,
      partyType, // 'CUSTOMER', 'SUPPLIER', 'EXPENSE', or 'INCOME'
      partyId,
      amount,
      paymentMode = 'Bank', // 'Cash', 'Bank', 'Cheque', 'UPI', 'NEFT/RTGS'
      bankAccountId = null,
      referenceNo = '',
      remarks = '',
      managerName = 'Admin',
      managerId = null,
      deviceId = ''
    } = req.body;

    const numAmount = Number(amount);
    if (!date || !partyType || !partyId || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid Date, Party Type, Party, and Amount (>0) are required.' });
    }
    if (!['CUSTOMER', 'SUPPLIER', 'EXPENSE', 'INCOME'].includes(partyType)) {
      return res.status(400).json({ error: 'Party Type must be CUSTOMER, SUPPLIER, EXPENSE, or INCOME.' });
    }

    if (partyType === 'CUSTOMER') {
      const c = await db.prepare('SELECT id FROM customers WHERE id = ?').get(partyId);
      if (!c) return res.status(400).json({ error: `Customer ID ${partyId} not found.` });
    } else if (partyType === 'SUPPLIER') {
      const s = await db.prepare('SELECT id FROM suppliers WHERE id = ?').get(partyId);
      if (!s) return res.status(400).json({ error: `Supplier ID ${partyId} not found.` });
    } else {
      const eh = await db.prepare('SELECT id, name, type FROM expense_heads WHERE id = ?').get(partyId);
      if (!eh) return res.status(400).json({ error: `Expense/Income Head ID ${partyId} not found.` });
    }

    const finalManagerName = (req.role === 'manager' && req.manager) ? req.manager.name : (managerName || 'Admin');
    const finalManagerId = (req.role === 'manager' && req.manager) ? req.manager.id : (managerId || null);
    const finalDeviceId = (req.role === 'manager' && req.manager) ? (req.manager.device_id || deviceId || '') : (deviceId || '');

    const prefix = partyType === 'CUSTOMER' ? 'REC' : (partyType === 'EXPENSE' ? 'EXP' : (partyType === 'INCOME' ? 'INC' : 'PAY'));
    const code = await getNextCode(prefix, 'payments', 'payment_code');

    const info = await db.prepare(`
      INSERT INTO payments (
        payment_code, date, party_type, party_id, amount, payment_mode, reference_no, remarks,
        created_by, manager_id, manager_name, device_id, bank_account_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, date, partyType, Number(partyId), numAmount, paymentMode, referenceNo, remarks, finalManagerName, finalManagerId, finalManagerName, finalDeviceId, bankAccountId ? Number(bankAccountId) : null);

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, new_values, performed_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('PAYMENT', code, 'CREATE', JSON.stringify({ partyType, partyId, amount: numAmount, paymentMode, referenceNo, bankAccountId }), finalManagerName, finalDeviceId);

    res.status(201).json({
      id: info.lastInsertRowid,
      payment_code: code,
      date,
      party_type: partyType,
      party_id: Number(partyId),
      amount: numAmount,
      payment_mode: paymentMode,
      bank_account_id: bankAccountId ? Number(bankAccountId) : null,
      reference_no: referenceNo,
      remarks,
      manager_name: finalManagerName
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/accounts/payments/:id', requireAdmin, async (req, res) => {
  try {
    const pay = await db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!pay) return res.status(404).json({ error: 'Payment record not found' });
    if (pay.is_voided) return res.status(400).json({ error: 'Cannot edit a voided payment.' });

    const { date, amount, paymentMode, bankAccountId, referenceNo, remarks, partyId, partyType, againstType } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    await db.prepare(`
      UPDATE payments
      SET date = COALESCE(?, date),
          amount = ?,
          payment_mode = COALESCE(?, payment_mode),
          bank_account_id = COALESCE(?, bank_account_id),
          reference_no = COALESCE(?, reference_no),
          remarks = COALESCE(?, remarks),
          party_id = COALESCE(?, party_id),
          party_type = COALESCE(?, party_type),
          against_type = COALESCE(?, against_type)
      WHERE id = ?
    `).run(
      date || null,
      numAmount,
      paymentMode || null,
      bankAccountId !== undefined ? (bankAccountId ? Number(bankAccountId) : null) : null,
      referenceNo !== undefined ? referenceNo : null,
      remarks !== undefined ? remarks : null,
      partyId ? Number(partyId) : null,
      partyType || null,
      againstType || null,
      pay.id
    );

    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, new_values, performed_by)
      VALUES (?, ?, 'EDIT', ?, ?, ?)
    `).run('PAYMENT', pay.payment_code, JSON.stringify(pay), JSON.stringify({ date, amount: numAmount, paymentMode, referenceNo, remarks, bankAccountId }), 'Admin');

    const updated = await db.prepare('SELECT * FROM payments WHERE id = ?').get(pay.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Void / Delete Payment (Admin only)
app.delete('/api/accounts/payments/:id', requireAdmin, async (req, res) => {
  try {
    const pay = await db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!pay) return res.status(404).json({ error: 'Payment record not found' });
    if (pay.is_voided) return res.status(400).json({ error: 'Payment is already voided.' });

    await db.prepare('UPDATE payments SET is_voided = 1 WHERE id = ?').run(pay.id);
    await db.prepare(`
      INSERT INTO audit_logs (entity_type, entity_id, action, original_values, performed_by)
      VALUES (?, ?, 'VOID', ?, 'Admin')
    `).run('PAYMENT', pay.payment_code, JSON.stringify(pay));

    res.json({ success: true, message: 'Payment entry voided successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================
// EXPENSE & INCOME LEDGER STATEMENT
// =============================================================
app.get('/api/accounts/expense-ledger', async (req, res) => {
  try {
    const { expenseHeadId, type, dateFrom, dateTo } = req.query;

    let headInfo = null;
    if (expenseHeadId) {
      headInfo = await db.prepare('SELECT * FROM expense_heads WHERE id = ?').get(expenseHeadId);
    }

    let query = `
      SELECT p.*,
             eh.name as head_name,
             eh.code as head_code,
             eh.type as head_type,
             eh.category as head_category,
             ba.bank_name,
             ba.account_name as bank_account_name
      FROM payments p
      JOIN expense_heads eh ON p.party_id = eh.id
      LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
      WHERE p.party_type IN ('EXPENSE', 'INCOME') AND p.is_voided = 0
    `;
    const params = [];
    if (expenseHeadId) {
      query += ' AND p.party_id = ?';
      params.push(expenseHeadId);
    }
    if (type) {
      query += ' AND p.party_type = ?';
      params.push(type.toUpperCase());
    }
    if (dateFrom) {
      query += ' AND p.date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND p.date <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY p.date ASC, p.id ASC';
    const rawRows = await db.prepare(query).all(...params);

    let totalAmount = 0;
    let cashTotal = 0;
    let bankTotal = 0;

    let runningTotal = 0;
    const transactions = rawRows.map(r => {
      const amt = Number(r.amount || 0);
      totalAmount += amt;
      runningTotal += amt;
      if (r.payment_mode === 'Cash') {
        cashTotal += amt;
      } else {
        bankTotal += amt;
      }

      return {
        id: `exp-${r.id}`,
        paymentId: r.id,
        date: r.date,
        voucher_no: r.payment_code,
        doc_no: r.payment_code,
        head_name: r.head_name,
        head_code: r.head_code,
        head_type: r.head_type,
        category: r.head_category,
        payment_mode: r.payment_mode,
        bank_name: r.bank_name || (r.payment_mode === 'Cash' ? 'Cash in Hand' : '—'),
        reference_no: r.reference_no || '',
        remarks: r.remarks || '',
        description: r.remarks || '',
        amount: amt,
        running_total: Number(runningTotal.toFixed(2)),
        created_by: r.manager_name || r.created_by || 'Admin',
        created_at: r.created_at
      };
    });

    if (!headInfo && transactions.length > 0) {
      const first = rawRows[0];
      headInfo = {
        id: first.party_id,
        code: first.head_code,
        name: first.head_name,
        type: first.head_type,
        category: first.head_category
      };
    }

    res.json({
      head: headInfo,
      expenseHead: headInfo,
      transactions,
      summary: {
        count: transactions.length,
        totalCount: transactions.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalIncurred: Number(totalAmount.toFixed(2)),
        cashTotal: Number(cashTotal.toFixed(2)),
        totalCash: Number(cashTotal.toFixed(2)),
        bankTotal: Number(bankTotal.toFixed(2)),
        totalBank: Number(bankTotal.toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory Stock Ledgers (Raw Materials & Finished Goods)
app.get('/api/inventory/raw-materials-ledger', requireAdmin, async (req, res) => {
  try {
    const { rawMaterialId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT m.*, rm.name as raw_material_name, rm.code as raw_material_code, rm.unit as master_unit
      FROM raw_material_movements m
      JOIN raw_materials rm ON m.raw_material_id = rm.id
      WHERE 1=1
    `;
    const params = [];
    if (rawMaterialId) { query += ' AND m.raw_material_id = ?'; params.push(rawMaterialId); }
    if (dateFrom) { query += ' AND date(m.created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND date(m.created_at) <= ?'; params.push(dateTo); }
    query += ' ORDER BY m.id DESC LIMIT 500';

    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory/finished-goods-ledger', requireAdmin, async (req, res) => {
  try {
    const { finishedProductId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT m.*, fp.product_name, fp.product_code, fp.gsm, fp.width_size, fp.colour, fp.unit as master_unit
      FROM finished_goods_movements m
      JOIN finished_products fp ON m.finished_product_id = fp.id
      WHERE 1=1
    `;
    const params = [];
    if (finishedProductId) { query += ' AND m.finished_product_id = ?'; params.push(finishedProductId); }
    if (dateFrom) { query += ' AND date(m.created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND date(m.created_at) <= ?'; params.push(dateTo); }
    query += ' ORDER BY m.id DESC LIMIT 500';

    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive CA / Tally 13 Export Registers
app.get(['/api/accounts/export', '/api/reports/ca-export'], requireAdmin, async (req, res) => {
  try {
    const { type = 'sales-register', dateFrom, dateTo, partyId, format = 'json' } = req.query;

    let data = [];

    // 1. Sales Register (GST)
    if (type === 'sales-register' || type === 'sales-gst') {
      let q = `
        SELECT s.date AS 'Date',
               s.invoice_number AS 'Invoice No',
               s.sale_code AS 'Sale Code',
               c.name AS 'Customer Name',
               COALESCE(c.gst_number, 'URP') AS 'GSTIN',
               c.state AS 'State',
               fp.product_name AS 'Item',
               si.hsn_code AS 'HSN Code',
               si.quantity AS 'Quantity',
               si.unit AS 'Unit',
               si.rate AS 'Rate',
               si.taxable_amount AS 'Taxable Value',
               si.gst_percent AS 'GST %',
               si.cgst_amount AS 'CGST',
               si.sgst_amount AS 'SGST',
               si.igst_amount AS 'IGST',
               si.total_amount AS 'Total Amount',
               s.payment_type AS 'Payment Mode',
               s.manager_name AS 'Entered By'
        FROM sales s
        JOIN customers c ON s.customer_id = c.id
        JOIN sales_items si ON s.id = si.sale_id
        JOIN finished_products fp ON si.finished_product_id = fp.id
        WHERE s.sales_type = 'GST' AND s.is_voided = 0
      `;
      const pms = [];
      if (dateFrom) { q += ' AND s.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND s.date <= ?'; pms.push(dateTo); }
      if (partyId) { q += ' AND s.customer_id = ?'; pms.push(partyId); }
      q += ' ORDER BY s.date DESC, s.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 2. Sales Register (Non-GST)
    else if (type === 'sales-register-nongst' || type === 'sales-nongst') {
      let q = `
        SELECT s.date AS 'Date',
               s.invoice_number AS 'Bill No',
               s.sale_code AS 'Sale Code',
               c.name AS 'Customer Name',
               c.state AS 'State',
               fp.product_name AS 'Item',
               si.quantity AS 'Quantity',
               si.unit AS 'Unit',
               si.rate AS 'Rate',
               si.total_amount AS 'Total Amount',
               s.payment_type AS 'Payment Mode',
               s.manager_name AS 'Entered By'
        FROM sales s
        JOIN customers c ON s.customer_id = c.id
        JOIN sales_items si ON s.id = si.sale_id
        JOIN finished_products fp ON si.finished_product_id = fp.id
        WHERE s.sales_type = 'NON_GST' AND s.is_voided = 0
      `;
      const pms = [];
      if (dateFrom) { q += ' AND s.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND s.date <= ?'; pms.push(dateTo); }
      if (partyId) { q += ' AND s.customer_id = ?'; pms.push(partyId); }
      q += ' ORDER BY s.date DESC, s.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 3. Purchase Register (GST)
    else if (type === 'purchase-register' || type === 'purchase-gst') {
      let q = `
        SELECT p.date AS 'Date',
               p.invoice_number AS 'Supplier Invoice No',
               p.purchase_code AS 'Purchase Code',
               s.name AS 'Supplier Name',
               COALESCE(s.gst_number, 'URP') AS 'GSTIN',
               s.state AS 'State',
               rm.name AS 'Raw Material',
               pi.hsn_code AS 'HSN Code',
               pi.quantity AS 'Quantity',
               pi.unit AS 'Unit',
               pi.rate AS 'Rate',
               pi.taxable_amount AS 'Taxable Value',
               pi.gst_percent AS 'GST %',
               pi.cgst_amount AS 'CGST',
               pi.sgst_amount AS 'SGST',
               pi.igst_amount AS 'IGST',
               pi.total_amount AS 'Total Amount',
               p.payment_mode AS 'Payment Mode',
               p.manager_name AS 'Entered By'
        FROM raw_material_purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN purchase_items pi ON p.id = pi.purchase_id
        JOIN raw_materials rm ON pi.raw_material_id = rm.id
        WHERE p.purchase_type = 'GST' AND p.is_voided = 0
      `;
      const pms = [];
      if (dateFrom) { q += ' AND p.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND p.date <= ?'; pms.push(dateTo); }
      if (partyId) { q += ' AND p.supplier_id = ?'; pms.push(partyId); }
      q += ' ORDER BY p.date DESC, p.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 4. Purchase Register (Non-GST)
    else if (type === 'purchase-register-nongst' || type === 'purchase-nongst') {
      let q = `
        SELECT p.date AS 'Date',
               p.invoice_number AS 'Challan/Bill No',
               p.purchase_code AS 'Purchase Code',
               s.name AS 'Supplier Name',
               rm.name AS 'Raw Material',
               pi.quantity AS 'Quantity',
               pi.unit AS 'Unit',
               pi.rate AS 'Rate',
               pi.total_amount AS 'Total Amount',
               p.payment_mode AS 'Payment Mode',
               p.manager_name AS 'Entered By'
        FROM raw_material_purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN purchase_items pi ON p.id = pi.purchase_id
        JOIN raw_materials rm ON pi.raw_material_id = rm.id
        WHERE p.purchase_type = 'NON_GST' AND p.is_voided = 0
      `;
      const pms = [];
      if (dateFrom) { q += ' AND p.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND p.date <= ?'; pms.push(dateTo); }
      if (partyId) { q += ' AND p.supplier_id = ?'; pms.push(partyId); }
      q += ' ORDER BY p.date DESC, p.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 5. Customer Receipts Register
    else if (type === 'customer-receipts' || type === 'customer-ledger-summary') {
      let q = `
        SELECT p.date AS 'Date',
               p.payment_code AS 'Receipt Code',
               c.name AS 'Customer Name',
               COALESCE(c.gst_number, 'URP') AS 'GSTIN',
               p.amount AS 'Amount Received',
               p.payment_mode AS 'Payment Mode',
               COALESCE(p.reference_no, '—') AS 'Ref / Chq / Txn No',
               p.remarks AS 'Remarks',
               p.created_by AS 'Entered By'
        FROM payments p
        JOIN customers c ON p.party_id = c.id
        WHERE p.party_type = 'CUSTOMER' AND p.is_voided = 0
      `;
      const pms = [];
      if (dateFrom) { q += ' AND p.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND p.date <= ?'; pms.push(dateTo); }
      if (partyId) { q += ' AND p.party_id = ?'; pms.push(partyId); }
      q += ' ORDER BY p.date DESC, p.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 6. Supplier Payments Register
    else if (type === 'supplier-payments' || type === 'supplier-ledger-summary') {
      let q = `
        SELECT p.date AS 'Date',
               p.payment_code AS 'Payment Code',
               s.name AS 'Supplier Name',
               COALESCE(s.gst_number, 'URP') AS 'GSTIN',
               p.amount AS 'Amount Paid',
               p.payment_mode AS 'Payment Mode',
               COALESCE(p.reference_no, '—') AS 'Ref / Chq / Txn No',
               p.remarks AS 'Remarks',
               p.created_by AS 'Entered By'
        FROM payments p
        JOIN suppliers s ON p.party_id = s.id
        WHERE p.party_type = 'SUPPLIER' AND p.is_voided = 0
      `;
      const pms = [];
      if (dateFrom) { q += ' AND p.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND p.date <= ?'; pms.push(dateTo); }
      if (partyId) { q += ' AND p.party_id = ?'; pms.push(partyId); }
      q += ' ORDER BY p.date DESC, p.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 7. Cash Book
    else if (type === 'cash-book') {
      const cSales = await db.prepare("SELECT date, invoice_number as doc, 'Cash Sale' as particulars, total_amount as debit, 0 as credit FROM sales WHERE payment_type = 'Cash' AND is_voided = 0").all();
      const cRecs = await db.prepare("SELECT p.date, p.payment_code as doc, 'Receipt: ' || c.name as particulars, p.amount as debit, 0 as credit FROM payments p JOIN customers c ON p.party_id = c.id WHERE p.party_type = 'CUSTOMER' AND p.payment_mode = 'Cash' AND p.is_voided = 0").all();
      const cPurs = await db.prepare("SELECT date, invoice_number as doc, 'Cash RM Purchase' as particulars, 0 as debit, total_amount as credit FROM raw_material_purchases WHERE payment_mode = 'Cash' AND is_voided = 0").all();
      const cPays = await db.prepare("SELECT p.date, p.payment_code as doc, 'Payment: ' || s.name as particulars, 0 as debit, p.amount as credit FROM payments p JOIN suppliers s ON p.party_id = s.id WHERE p.party_type = 'SUPPLIER' AND p.payment_mode = 'Cash' AND p.is_voided = 0").all();
      data = [...cSales, ...cRecs, ...cPurs, ...cPays].sort((a, b) => a.date.localeCompare(b.date));
    }

    // 8. Bank Book
    else if (type === 'bank-book') {
      const bSales = await db.prepare("SELECT date, invoice_number as doc, 'Bank Sale' as particulars, total_amount as debit, 0 as credit FROM sales WHERE payment_type = 'Bank' AND is_voided = 0").all();
      const bRecs = await db.prepare("SELECT p.date, p.payment_code as doc, 'Receipt: ' || c.name as particulars, p.amount as debit, 0 as credit FROM payments p JOIN customers c ON p.party_id = c.id WHERE p.party_type = 'CUSTOMER' AND p.payment_mode != 'Cash' AND p.is_voided = 0").all();
      const bPurs = await db.prepare("SELECT date, invoice_number as doc, 'Bank RM Purchase' as particulars, 0 as debit, total_amount as credit FROM raw_material_purchases WHERE payment_mode = 'Bank' AND is_voided = 0").all();
      const bPays = await db.prepare("SELECT p.date, p.payment_code as doc, 'Payment: ' || s.name as particulars, 0 as debit, p.amount as credit FROM payments p JOIN suppliers s ON p.party_id = s.id WHERE p.party_type = 'SUPPLIER' AND p.payment_mode != 'Cash' AND p.is_voided = 0").all();
      data = [...bSales, ...bRecs, ...bPurs, ...bPays].sort((a, b) => a.date.localeCompare(b.date));
    }

    // 9. Raw Material Consumption Register
    else if (type === 'rm-consumption' || type === 'material-issue-register') {
      let q = `
        SELECT cb.date AS 'Date',
               cb.batch_no AS 'Issue Batch No',
               po.order_no AS 'Production Order No',
               m.name AS 'Machine',
               sh.name AS 'Shift',
               rm.name AS 'Raw Material',
               cbi.quantity AS 'Issued Quantity',
               cbi.unit AS 'Unit',
               cb.manager_name AS 'Issued By'
        FROM consumption_batches cb
        JOIN consumption_batch_items cbi ON cb.id = cbi.consumption_batch_id
        JOIN raw_materials rm ON cbi.raw_material_id = rm.id
        LEFT JOIN production_orders po ON cb.production_order_id = po.id
        LEFT JOIN machines m ON cb.machine_id = m.id
        LEFT JOIN shifts sh ON cb.shift_id = sh.id
        WHERE 1=1
      `;
      const pms = [];
      if (dateFrom) { q += ' AND cb.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND cb.date <= ?'; pms.push(dateTo); }
      q += ' ORDER BY cb.date DESC, cb.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 10. Production & Yield Register
    else if (type === 'production-yield' || type === 'production-register') {
      let q = `
        SELECT pb.date AS 'Date',
               pb.batch_code AS 'Batch No',
               m.name AS 'Machine',
               sh.name AS 'Shift',
               pb.raw_material_used_kg AS 'RM Used (KG)',
               pb.total_finished_kg AS 'FG Produced (KG)',
               pb.total_wastage_kg AS 'Wastage (KG)',
               ROUND((pb.total_finished_kg / NULLIF(pb.raw_material_used_kg, 0)) * 100, 2) AS 'Yield %',
               ROUND((pb.total_wastage_kg / NULLIF(pb.raw_material_used_kg, 0)) * 100, 2) AS 'Wastage %',
               pb.manager_name AS 'Operator/Manager'
        FROM production_batches pb
        LEFT JOIN machines m ON pb.machine_id = m.id
        LEFT JOIN shifts sh ON pb.shift_id = sh.id
        WHERE pb.is_voided = 0
      `;
      const pms = [];
      if (dateFrom) { q += ' AND pb.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND pb.date <= ?'; pms.push(dateTo); }
      q += ' ORDER BY pb.date DESC, pb.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 11. Wastage Register
    else if (type === 'wastage-register') {
      let q = `
        SELECT wr.date AS 'Date',
               COALESCE(pb.batch_code, wr.production_no) AS 'Batch Code',
               fp.product_name AS 'Finished Product',
               wr.quantity AS 'Wastage Qty (KG)',
               wr.reason AS 'Reason',
               m.name AS 'Machine',
               wr.manager_name AS 'Reported By'
        FROM wastage_records wr
        LEFT JOIN production_batches pb ON wr.production_id = pb.id
        LEFT JOIN finished_products fp ON wr.product_id = fp.id
        LEFT JOIN machines m ON wr.machine_id = m.id
        WHERE 1=1
      `;
      const pms = [];
      if (dateFrom) { q += ' AND wr.date >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND wr.date <= ?'; pms.push(dateTo); }
      q += ' ORDER BY wr.date DESC, wr.id DESC';
      data = await db.prepare(q).all(...pms);
    }

    // 12. Customer Outstanding Summary Register
    else if (type === 'customer-outstanding') {
      const customers = await db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
      data = await Promise.all(customers.map(async c => {
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
      }));
    }

    // 13. Supplier Outstanding Summary Register
    else if (type === 'supplier-outstanding') {
      const suppliers = await db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
      data = await Promise.all(suppliers.map(async s => {
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
      }));
    }

    // 14. RM Stock Movement Ledger
    else if (type === 'rm-stock-ledger') {
      let q = `
        SELECT date(m.created_at) AS 'Date',
               rm.name AS 'Raw Material',
               rm.code AS 'Code',
               m.movement_type AS 'Movement Type',
               m.quantity_change AS 'Quantity Change',
               rm.unit AS 'Unit',
               m.reference_id AS 'Reference ID',
               COALESCE(m.remarks, '—') AS 'Remarks'
        FROM raw_material_movements m
        JOIN raw_materials rm ON m.raw_material_id = rm.id
        WHERE 1=1
      `;
      const pms = [];
      if (dateFrom) { q += ' AND date(m.created_at) >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND date(m.created_at) <= ?'; pms.push(dateTo); }
      q += ' ORDER BY m.id DESC LIMIT 1000';
      data = await db.prepare(q).all(...pms);
    }

    // 15. FG Stock Movement Ledger
    else if (type === 'fg-stock-ledger') {
      let q = `
        SELECT date(m.created_at) AS 'Date',
               fp.product_name AS 'Product Name',
               fp.product_code AS 'Code',
               fp.gsm AS 'GSM',
               fp.width_size AS 'Size',
               fp.colour AS 'Colour',
               m.movement_type AS 'Movement Type',
               m.quantity_change AS 'Quantity Change',
               fp.unit AS 'Unit',
               m.reference_id AS 'Reference ID',
               COALESCE(m.remarks, '—') AS 'Remarks'
        FROM finished_goods_movements m
        JOIN finished_products fp ON m.finished_product_id = fp.id
        WHERE 1=1
      `;
      const pms = [];
      if (dateFrom) { q += ' AND date(m.created_at) >= ?'; pms.push(dateFrom); }
      if (dateTo) { q += ' AND date(m.created_at) <= ?'; pms.push(dateTo); }
      q += ' ORDER BY m.id DESC LIMIT 1000';
      data = await db.prepare(q).all(...pms);
    }

    // Legacy gst-data compatibility
    else if (type === 'gst-data') {
      const sList = await db.prepare("SELECT invoice_number as 'Invoice No', date as 'Date', 'Sale' as 'Type', customer_gstin as 'GSTIN', taxable_amount as 'Taxable', cgst_amount as 'CGST', sgst_amount as 'SGST', igst_amount as 'IGST', total_amount as 'Total' FROM sales WHERE sales_type = 'GST' AND is_voided = 0").all();
      const pList = await db.prepare("SELECT p.invoice_number as 'Invoice No', p.date as 'Date', 'Purchase' as 'Type', COALESCE(s.gst_number, 'URP') as 'GSTIN', p.taxable_amount as 'Taxable', p.cgst_amount as 'CGST', p.sgst_amount as 'SGST', p.igst_amount as 'IGST', p.total_amount as 'Total' FROM raw_material_purchases p JOIN suppliers s ON p.supplier_id = s.id WHERE p.purchase_type = 'GST' AND p.is_voided = 0").all();
      data = [...sList, ...pList].sort((a, b) => b.Date.localeCompare(a.Date));
    } else {
      return res.status(400).json({ error: `Unknown export register type: ${type}` });
    }

    // Format output: CSV or JSON
    if (format === 'csv') {
      if (data.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
        return res.send('');
      }
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          return `"${val.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
      return res.send(csvRows.join('\r\n'));
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full GST Invoice Details for a Sale (Multi-Item Aware)
app.get('/api/invoices/:saleId', async (req, res) => {
  try {
    const sale = await db.prepare(`
      SELECT s.*,
             c.name AS customer_name, c.customer_code, c.phone AS customer_phone, c.email AS customer_email, c.gst_number AS customer_gstin,
             c.address AS customer_address, c.billing_address, c.shipping_address, c.state AS customer_state,
             COALESCE(c.city, 'Ahmedabad') AS customer_city, COALESCE(c.pincode, '382445') AS customer_pincode, COALESCE(c.state_code, '24') AS customer_state_code,
             fp.product_name, fp.product_code, fp.gsm, fp.width_size, fp.length_val, fp.colour, fp.grade,
             fp.hsn_code AS product_hsn
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      LEFT JOIN finished_products fp ON s.finished_product_id = fp.id
      WHERE s.id = ?
    `).get(req.params.saleId);

    if (!sale) return res.status(404).json({ error: 'Sale / Invoice not found' });

    const company = getCompanySettings();
    const amountWords = numberToWords(sale.total_amount);

    const itemsFromTable = await db.prepare(`
      SELECT si.*, fp.product_name, fp.product_code, fp.colour, fp.grade
      FROM sales_items si
      JOIN finished_products fp ON si.finished_product_id = fp.id
      WHERE si.sale_id = ?
    `).all(sale.id);

    const finalItems = itemsFromTable.length > 0 ? itemsFromTable : [{
      finished_product_id: sale.finished_product_id,
      product_name: sale.product_name || 'Tarpaulin / Finished Good',
      product_code: sale.product_code || 'FG-001',
      gsm: sale.gsm,
      size: sale.width_size,
      hsn_code: sale.product_hsn || '3926',
      quantity: sale.quantity_kg,
      unit: 'KG',
      rate: sale.rate_per_kg,
      discount: 0,
      gst_percent: sale.gst_percent,
      taxable_amount: sale.taxable_amount,
      cgst_amount: sale.cgst_amount,
      sgst_amount: sale.sgst_amount,
      igst_amount: sale.igst_amount,
      total_amount: sale.total_amount
    }];

    res.json({
      company,
      invoice: {
        id: sale.id,
        invoiceNumber: sale.invoice_number || sale.sale_code,
        saleCode: sale.sale_code,
        date: sale.date,
        salesType: sale.sales_type || 'GST',
        paymentType: sale.payment_type || 'Cash',
        stateCode: sale.state_code || sale.customer_state_code || '24',
        reverseCharge: sale.reverse_charge || 'No',
        billingAddress: sale.billing_address || sale.customer_address || '—',
        shippingAddress: sale.shipping_address || sale.billing_address || sale.customer_address || '—',
        shippingName: sale.shipping_name || sale.customer_name || '—',
        customerGstin: sale.customer_gstin || 'Unregistered',
        termsConditions: sale.terms_conditions || '',
        discountAmount: sale.discount_amount || 0,
        otherCharges: sale.other_charges || 0,
        roundOff: sale.round_off || 0,
        remarks: sale.remarks || '',
        managerName: sale.manager_name,
        taxableAmount: sale.taxable_amount,
        cgstAmount: sale.cgst_amount,
        sgstAmount: sale.sgst_amount,
        igstAmount: sale.igst_amount,
        totalAmount: sale.total_amount
      },
      customer: {
        id: sale.customer_id,
        name: sale.customer_name,
        code: sale.customer_code,
        phone: sale.customer_phone || '—',
        email: sale.customer_email || '—',
        gstin: sale.customer_gstin || 'Unregistered',
        billingAddress: sale.billing_address || sale.customer_address || '—',
        shippingAddress: sale.shipping_address || sale.billing_address || sale.customer_address || '—',
        city: sale.customer_city || 'Ahmedabad',
        state: sale.customer_state || 'Gujarat',
        pincode: sale.customer_pincode || '382445',
        stateCode: sale.customer_state_code || '24'
      },
      items: finalItems,
      amountInWords: amountWords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Official NIC / GST Schema Compliant E-Invoice JSON
app.get('/api/invoices/:saleId/e-invoice-json', async (req, res) => {
  try {
    const sale = await db.prepare(`
      SELECT s.*, c.name AS customer_name, c.gst_number AS customer_gstin,
             c.billing_address, c.shipping_address, c.address AS customer_address,
             c.state AS customer_state, c.email AS customer_email, c.phone AS customer_phone
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(req.params.saleId);

    if (!sale) return res.status(404).json({ error: 'Sale record not found' });

    const company = getCompanySettings();
    const items = await db.prepare(`
      SELECT si.*, fp.product_name, fp.product_code
      FROM sales_items si
      JOIN finished_products fp ON si.finished_product_id = fp.id
      WHERE si.sale_id = ?
    `).all(sale.id);

    const invoiceDate = sale.date || new Date().toISOString().split('T')[0];
    const [y, m, d] = invoiceDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    const itemList = (items.length > 0 ? items : [{
      product_name: 'Plastic Tarpaulin / Tripal',
      hsn_code: '3926',
      quantity: sale.quantity_kg,
      unit: 'KG',
      rate: sale.rate_per_kg,
      taxable_amount: sale.taxable_amount,
      gst_percent: sale.gst_percent,
      cgst_amount: sale.cgst_amount,
      sgst_amount: sale.sgst_amount,
      igst_amount: sale.igst_amount,
      total_amount: sale.total_amount
    }]).map((it, idx) => ({
      SlNo: String(idx + 1),
      PrdDesc: it.product_name,
      IsServc: "N",
      HsnCd: String(it.hsn_code || '3926'),
      Qty: Number(it.quantity || 0),
      Unit: (it.unit || 'KG').toUpperCase() === 'KG' ? 'KGS' : (it.unit || 'PCS').toUpperCase(),
      UnitPrice: Number(it.rate || 0),
      TotAmt: Number((it.quantity * it.rate).toFixed(2)),
      Discount: Number((it.discount || 0).toFixed(2)),
      AssAmt: Number(it.taxable_amount.toFixed(2)),
      GstRt: Number(it.gst_percent || 18),
      IgstAmt: Number((it.igst_amount || 0).toFixed(2)),
      CgstAmt: Number((it.cgst_amount || 0).toFixed(2)),
      SgstAmt: Number((it.sgst_amount || 0).toFixed(2)),
      TotItemVal: Number(it.total_amount.toFixed(2))
    }));

    const eInvoicePayload = {
      Version: "1.1",
      TranDtls: {
        TaxSch: "GST",
        SupTyp: (sale.customer_gstin && sale.customer_gstin.length === 15) ? "B2B" : "B2C",
        RegRev: "N",
        EcmGstin: null,
        IgstOnIntra: "N"
      },
      DocDtls: {
        Typ: "INV",
        No: sale.invoice_number || sale.sale_code,
        Dt: formattedDate
      },
      SellerDtls: {
        Gstin: company.gstNumber || "24AAAAA0000A1Z5",
        LglNm: company.companyName || "TRIPAL MANUFACTURING PVT LTD",
        TrdNm: company.companyName || "TRIPAL MANUFACTURING PVT LTD",
        Addr1: company.address || "Factory Plot 12, Industrial Estate",
        Loc: company.city || "Ahmedabad",
        Pin: Number(company.pincode || 382445),
        Stcd: company.stateCode || "24",
        Ph: company.phone || null,
        Em: company.email || null
      },
      BuyerDtls: {
        Gstin: sale.customer_gstin || "URP",
        LglNm: sale.customer_name,
        TrdNm: sale.customer_name,
        Pos: sale.customer_state_code || "24",
        Addr1: sale.billing_address || sale.customer_address || "Customer Address",
        Loc: sale.customer_state || "Gujarat",
        Pin: Number(sale.customer_pincode || 380001),
        Stcd: sale.customer_state_code || "24",
        Ph: sale.customer_phone || null
      },
      DispDtls: {
        Nm: company.companyName || "TRIPAL MANUFACTURING PVT LTD",
        Addr1: company.address || "Factory Plot 12, Industrial Estate",
        Loc: company.city || "Ahmedabad",
        Pin: Number(company.pincode || 382445),
        Stcd: company.stateCode || "24"
      },
      ShipDtls: {
        Gstin: sale.customer_gstin || "URP",
        LglNm: sale.customer_name,
        TrdNm: sale.customer_name,
        Addr1: sale.shipping_address || sale.customer_address || "Customer Address",
        Loc: sale.customer_state || "Gujarat",
        Pin: Number(sale.customer_pincode || 380001),
        Stcd: sale.customer_state_code || "24"
      },
      ItemList: itemList,
      ValDtls: {
        AssVal: Number(sale.taxable_amount.toFixed(2)),
        CgstVal: Number(sale.cgst_amount.toFixed(2)),
        SgstVal: Number(sale.sgst_amount.toFixed(2)),
        IgstVal: Number(sale.igst_amount.toFixed(2)),
        Discount: Number((sale.discount_amount || 0).toFixed(2)),
        OthChrg: Number((sale.other_charges || 0).toFixed(2)),
        RndOffAmt: Number((sale.round_off || 0).toFixed(2)),
        TotInvVal: Number(sale.total_amount.toFixed(2))
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="e-invoice-${sale.invoice_number || sale.sale_code}.json"`);
    res.json(eInvoicePayload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Official E-Way Bill Schema Compliant JSON
app.get('/api/invoices/:saleId/e-waybill-json', async (req, res) => {
  try {
    const sale = await db.prepare(`
      SELECT s.*, c.name AS customer_name, c.gst_number AS customer_gstin,
             c.billing_address, c.shipping_address, c.address AS customer_address,
             c.state AS customer_state, c.phone AS customer_phone
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(req.params.saleId);

    if (!sale) return res.status(404).json({ error: 'Sale record not found' });

    const company = getCompanySettings();
    const items = await db.prepare(`
      SELECT si.*, fp.product_name, fp.product_code
      FROM sales_items si
      JOIN finished_products fp ON si.finished_product_id = fp.id
      WHERE si.sale_id = ?
    `).all(sale.id);

    const invoiceDate = sale.date || new Date().toISOString().split('T')[0];
    const [y, m, d] = invoiceDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    const itemList = (items.length > 0 ? items : [{
      product_name: 'Plastic Tarpaulin / Tripal',
      hsn_code: '3926',
      quantity: sale.quantity_kg,
      unit: 'KG',
      taxable_amount: sale.taxable_amount,
      cgst_amount: sale.cgst_amount,
      sgst_amount: sale.sgst_amount,
      igst_amount: sale.igst_amount
    }]).map((it) => ({
      itemNo: 1,
      productName: it.product_name,
      productDesc: it.product_name,
      hsnCode: Number(it.hsn_code || '3926'),
      quantity: Number(it.quantity || 0),
      qtyUnit: (it.unit || 'KG').toUpperCase() === 'KG' ? 'KGS' : (it.unit || 'PCS').toUpperCase(),
      cgstRate: Number(sale.cgst_amount > 0 ? ((it.gst_percent || 18) / 2) : 0),
      sgstRate: Number(sale.sgst_amount > 0 ? ((it.gst_percent || 18) / 2) : 0),
      igstRate: Number(sale.igst_amount > 0 ? (it.gst_percent || 18) : 0),
      cessRate: 0,
      cessNonAdvol: 0,
      taxableAmount: Number(it.taxable_amount.toFixed(2))
    }));

    const eWayBillPayload = {
      supplyType: "O",
      subSupplyType: "1",
      subSupplyDesc: "Supply",
      docType: "INV",
      docNo: sale.invoice_number || sale.sale_code,
      docDate: formattedDate,
      fromGstin: company.gstNumber || "24AAAAA0000A1Z5",
      fromTrdName: company.companyName || "TRIPAL MANUFACTURING PVT LTD",
      fromAddr1: company.address || "Factory Plot 12, Industrial Estate",
      fromAddr2: "",
      fromPlace: company.city || "Ahmedabad",
      fromPincode: Number(company.pincode || 382445),
      actFromStateCode: Number(company.stateCode || 24),
      fromStateCode: Number(company.stateCode || 24),
      toGstin: sale.customer_gstin || "URP",
      toTrdName: sale.customer_name,
      toAddr1: sale.shipping_address || sale.billing_address || sale.customer_address || "Customer Address",
      toAddr2: "",
      toPlace: sale.customer_state || "Gujarat",
      toPincode: 380001,
      actToStateCode: 24,
      toStateCode: 24,
      transactionType: 1,
      totalValue: Number(sale.taxable_amount.toFixed(2)),
      cgstValue: Number(sale.cgst_amount.toFixed(2)),
      sgstValue: Number(sale.sgst_amount.toFixed(2)),
      igstValue: Number(sale.igst_amount.toFixed(2)),
      cessValue: 0,
      totInvValue: Number(sale.total_amount.toFixed(2)),
      transDistance: 0,
      transporterId: "",
      transporterName: "",
      transDocNo: "",
      transDocDate: "",
      vehicleNo: "",
      vehicleType: "R",
      itemList: itemList
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="e-waybill-${sale.invoice_number || sale.sale_code}.json"`);
    res.json(eWayBillPayload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  await initDb();
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`TRIPAL ERP Server running on port ${PORT}`);
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

module.exports = { app, startServer };
