// Centralized API client for Tripal Manufacturing ERP

const API_BASE = '/api';

// Session storage helpers
export const session = {
  get: () => {
    try {
      const raw = localStorage.getItem('tripal_session');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set: (data) => localStorage.setItem('tripal_session', JSON.stringify(data)),
  clear: () => localStorage.removeItem('tripal_session'),
  getToken: () => {
    const s = session.get();
    return s ? s.token : null;
  },
  getRole: () => {
    const s = session.get();
    return s ? (s.user?.role || 'admin') : null;
  },
  getUser: () => {
    const s = session.get();
    return s ? s.user : null;
  },
  isAdmin: () => session.getRole() === 'admin',
  isManager: () => session.getRole() === 'manager',
};

export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = session.getToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      // Send Bearer token for all requests when logged in via web session
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // If 401, session is invalid — clear it so login screen shows
      if (response.status === 401) {
        session.clear();
        window.location.href = '/';
      }
      throw new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getCurrentUser: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Manager web user management (Admin only)
  getManagerUsers: () => request('/auth/manager-users'),
  createManagerUser: (data) => request('/auth/create-manager-user', { method: 'POST', body: JSON.stringify(data) }),
  updateManagerUserStatus: (id, status) => request(`/auth/manager-users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  resetManagerUserPassword: (id, newPassword) => request(`/auth/manager-users/${id}/password`, { method: 'PUT', body: JSON.stringify({ newPassword }) }),
  deleteManagerUser: (id) => request(`/auth/manager-users/${id}`, { method: 'DELETE' }),
  updateManagerUserPermissions: (id, permissions) => request(`/auth/manager-users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),

  // Dashboard & Stats
  getDashboardStats: () => request('/dashboard/stats'),

  // Masters
  getAllMasters: () => request('/masters/all'),
  getRawMaterials: () => request('/masters/raw-materials'),
  createRawMaterial: (data) => request('/masters/raw-materials', { method: 'POST', body: JSON.stringify(data) }),
  updateRawMaterial: (id, data) => request(`/masters/raw-materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRawMaterial: (id) => request(`/masters/raw-materials/${id}`, { method: 'DELETE' }),

  getFinishedGoods: () => request('/masters/finished-goods'),
  createFinishedGood: (data) => request('/masters/finished-goods', { method: 'POST', body: JSON.stringify(data) }),
  updateFinishedGood: (id, data) => request(`/masters/finished-goods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFinishedGood: (id) => request(`/masters/finished-goods/${id}`, { method: 'DELETE' }),

  getCustomers: () => request('/masters/customers'),
  createCustomer: (data) => request('/masters/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/masters/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/masters/customers/${id}`, { method: 'DELETE' }),

  getSuppliers: () => request('/masters/suppliers'),
  createSupplier: (data) => request('/masters/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id, data) => request(`/masters/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id) => request(`/masters/suppliers/${id}`, { method: 'DELETE' }),

  getMachines: () => request('/masters/machines'),
  createMachine: (data) => request('/masters/machines', { method: 'POST', body: JSON.stringify(data) }),
  updateMachine: (id, data) => request(`/masters/machines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMachine: (id) => request(`/masters/machines/${id}`, { method: 'DELETE' }),

  getShifts: () => request('/masters/shifts'),
  createShift: (data) => request('/masters/shifts', { method: 'POST', body: JSON.stringify(data) }),
  updateShift: (id, data) => request(`/masters/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShift: (id) => request(`/masters/shifts/${id}`, { method: 'DELETE' }),

  getExpenseHeads: (params = '') => request(`/masters/expense-heads${params ? `?${params}` : ''}`),
  createExpenseHead: (data) => request('/masters/expense-heads', { method: 'POST', body: JSON.stringify(data) }),
  updateExpenseHead: (id, data) => request(`/masters/expense-heads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpenseHead: (id) => request(`/masters/expense-heads/${id}`, { method: 'DELETE' }),

  getManagers: () => request('/masters/managers'),
  createManager: (data) => request('/masters/managers', { method: 'POST', body: JSON.stringify(data) }),
  updateManager: (id, data) => request(`/masters/managers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateManagerStatus: (id, status) => request(`/masters/managers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  updateManagerPermissions: (id, permissions) => request(`/masters/managers/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  deleteManager: (id) => request(`/masters/managers/${id}`, { method: 'DELETE' }),
  registerManager: (data) => request('/managers/register', { method: 'POST', body: JSON.stringify(data) }),
  getManagerActivity: (managerName = '') => request(`/managers/activity${managerName ? `?managerName=${encodeURIComponent(managerName)}` : ''}`),
  getMyEntries: (managerName) => request(`/managers/my-entries?managerName=${encodeURIComponent(managerName)}`),

  // Staff Master
  getStaff: (status = '') => request(`/masters/staff${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createStaff: (data) => request('/masters/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id, data) => request(`/masters/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id) => request(`/masters/staff/${id}`, { method: 'DELETE' }),

  // Staff Attendance
  getAttendance: (params = '') => {
    if (typeof params === 'string') {
      return request(`/attendance${params ? (params.startsWith('?') ? params : `?${params}`) : ''}`);
    }
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.month) qs.set('month', params.month);
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.staffId) qs.set('staffId', params.staffId);
    const query = qs.toString();
    return request(`/attendance${query ? `?${query}` : ''}`);
  },
  saveAttendanceBulk: (data) => request('/attendance/bulk', { method: 'POST', body: JSON.stringify(data) }),
  saveBulkAttendance: (data) => request('/attendance/bulk', { method: 'POST', body: JSON.stringify(data) }),
  getAttendanceSummary: (month = '') => request(`/attendance/summary${month ? `?month=${encodeURIComponent(month)}` : ''}`),

  // Transactions
  getPurchases: (params = '') => request(`/transactions/purchases${params ? `?${params}` : ''}`),
  getPurchase: (id) => request(`/transactions/purchases/${id}`),
  createPurchase: (data) => request('/transactions/purchases', { method: 'POST', body: JSON.stringify(data) }),
  updatePurchase: (id, data) => request(`/transactions/purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePurchase: (id) => request(`/transactions/purchases/${id}`, { method: 'DELETE' }),

  getProductions: (params = '') => request(`/transactions/production${params ? `?${params}` : ''}`),
  createProduction: (data) => request('/transactions/production', { method: 'POST', body: JSON.stringify(data) }),
  updateProduction: (id, data) => request(`/transactions/production/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduction: (id) => request(`/transactions/production/${id}`, { method: 'DELETE' }),

  getSales: (params = '') => request(`/transactions/sales${params ? `?${params}` : ''}`),
  createSale: (data) => request('/transactions/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateSale: (id, data) => request(`/transactions/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSale: (id) => request(`/transactions/sales/${id}`, { method: 'DELETE' }),

  // Company Profile Settings
  getCompanySettings: () => request('/company/settings'),
  updateCompanySettings: (data) => request('/company/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Production Orders (Customer Orders)
  getProductionOrders: (params = '') => request(`/transactions/production-orders${params ? `?${params}` : ''}`),
  createProductionOrder: (data) => request('/transactions/production-orders', { method: 'POST', body: JSON.stringify(data) }),
  updateProductionOrder: (id, data) => request(`/transactions/production-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateProductionOrderStatus: (id, status) => request(`/transactions/production-orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteProductionOrder: (id) => request(`/transactions/production-orders/${id}`, { method: 'DELETE' }),

  // Consumption / Material Issue Batches
  getConsumptionBatches: (params = '') => request(`/transactions/consumption-batches${params ? `?${params}` : ''}`),
  createConsumptionBatch: (data) => request('/transactions/consumption-batches', { method: 'POST', body: JSON.stringify(data) }),
  updateConsumptionBatchStatus: (id, status) => request(`/transactions/consumption-batches/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteConsumptionBatch: (id) => request(`/transactions/consumption-batches/${id}`, { method: 'DELETE' }),

  // Inventory & Reconciliation
  getRawMaterialStock: () => request('/inventory/raw-materials'),
  getFinishedGoodsStock: () => request('/inventory/finished-goods'),
  getStockLedger: (params = '') => request(`/inventory/ledger${params ? `?${params}` : ''}`),
  getReconciliations: () => request('/inventory/reconciliation'),
  createReconciliation: (data) => request('/inventory/reconciliation', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getWastageReport: (params = '') => request(`/reports/wastage${params ? `?${params}` : ''}`),
  getConsumptionReport: (params = '') => request(`/reports/consumption${params ? `?${params}` : ''}`),
  getCustomerSalesReport: (params = '') => request(`/reports/customer-sales${params ? `?${params}` : ''}`),
  getAuditLogs: () => request('/audit-logs'),

  // Accounts & Ledgers
  getCustomerLedger: (customerId, dateFrom, dateTo, financialYear) => {
    const p = new URLSearchParams({ customerId });
    if (dateFrom) p.append('dateFrom', dateFrom);
    if (dateTo) p.append('dateTo', dateTo);
    if (financialYear) p.append('financialYear', financialYear);
    return request(`/accounts/customer-ledger?${p}`);
  },
  getSupplierLedger: (supplierId, dateFrom, dateTo, financialYear) => {
    const p = new URLSearchParams({ supplierId });
    if (dateFrom) p.append('dateFrom', dateFrom);
    if (dateTo) p.append('dateTo', dateTo);
    if (financialYear) p.append('financialYear', financialYear);
    return request(`/accounts/supplier-ledger?${p}`);
  },
  getCashLedger: (dateFrom, dateTo, financialYear) => {
    const p = new URLSearchParams();
    if (dateFrom) p.append('dateFrom', dateFrom);
    if (dateTo) p.append('dateTo', dateTo);
    if (financialYear) p.append('financialYear', financialYear);
    return request(`/accounts/cash-ledger?${p}`);
  },
  getBankLedger: (dateFrom, dateTo, bankAccountId, financialYear) => {
    const p = new URLSearchParams();
    if (dateFrom) p.append('dateFrom', dateFrom);
    if (dateTo) p.append('dateTo', dateTo);
    if (bankAccountId) p.append('bankAccountId', bankAccountId);
    if (financialYear) p.append('financialYear', financialYear);
    return request(`/accounts/bank-ledger?${p}`);
  },
  getCustomerOutstanding: (financialYear) => request(`/accounts/customer-outstanding${financialYear ? `?financialYear=${financialYear}` : ''}`),
  getSupplierOutstanding: (financialYear) => request(`/accounts/supplier-outstanding${financialYear ? `?financialYear=${financialYear}` : ''}`),
  getPayments: (params = '') => request(`/accounts/payments${params ? `?${params}` : ''}`),
  createPayment: (data) => request('/accounts/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => request(`/accounts/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id) => request(`/accounts/payments/${id}`, { method: 'DELETE' }),
  getExpenseLedger: (expenseHeadId, dateFrom, dateTo, type) => {
    const p = new URLSearchParams();
    if (expenseHeadId) p.append('expenseHeadId', expenseHeadId);
    if (type) p.append('type', type);
    if (dateFrom) p.append('dateFrom', dateFrom);
    if (dateTo) p.append('dateTo', dateTo);
    return request(`/accounts/expense-ledger?${p}`);
  },
  getInvoice: (saleId) => request(`/invoices/${saleId}`),
  getEInvoiceJson: (saleId) => request(`/invoices/${saleId}/e-invoice-json`),
  getEWayBillJson: (saleId) => request(`/invoices/${saleId}/e-waybill-json`),
  getExportData: (type, dateFrom, dateTo, partyId) => {
    const p = new URLSearchParams({ type });
    if (dateFrom) p.append('dateFrom', dateFrom);
    if (dateTo) p.append('dateTo', dateTo);
    if (partyId) p.append('partyId', partyId);
    return request(`/accounts/export?${p}`);
  },

  // Financial Years
  getFinancialYears: () => request('/financial-years'),
  createFinancialYear: (data) => request('/financial-years', { method: 'POST', body: JSON.stringify(data) }),
  setActiveFinancialYear: (name) => request('/financial-years/active', { method: 'PUT', body: JSON.stringify({ name }) }),

  // Bank Master
  getBankAccounts: () => request('/masters/bank-accounts'),
  createBankAccount: (data) => request('/masters/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateBankAccount: (id, data) => request(`/masters/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBankAccount: (id) => request(`/masters/bank-accounts/${id}`, { method: 'DELETE' }),

  // Bank Transfers
  getBankTransfers: (params = '') => request(`/accounts/bank-transfers${params ? `?${params}` : ''}`),
  createBankTransfer: (data) => request('/accounts/bank-transfers', { method: 'POST', body: JSON.stringify(data) }),
  deleteBankTransfer: (id) => request(`/accounts/bank-transfers/${id}`, { method: 'DELETE' }),

  // Opening Balances
  getOpeningBalances: (params = '') => request(`/accounts/opening-balances${params ? `?${params}` : ''}`),
  createOpeningBalance: (data) => request('/accounts/opening-balances', { method: 'POST', body: JSON.stringify(data) }),
  updateOpeningBalance: (id, data) => request(`/accounts/opening-balances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOpeningBalance: (id) => request(`/accounts/opening-balances/${id}`, { method: 'DELETE' }),
  carryForwardFinancialYear: (data) => request('/accounts/carry-forward', { method: 'POST', body: JSON.stringify(data) }),

  // Debit / Credit Notes
  getDebitCreditNotes: (params = '') => request(`/accounts/debit-credit-notes${params ? `?${params}` : ''}`),
  createDebitCreditNote: (data) => request('/accounts/debit-credit-notes', { method: 'POST', body: JSON.stringify(data) }),
  updateDebitCreditNote: (id, data) => request(`/accounts/debit-credit-notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDebitCreditNote: (id) => request(`/accounts/debit-credit-notes/${id}`, { method: 'DELETE' }),

};

