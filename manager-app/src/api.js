// API client for Tripal Manager Mobile App
// Automatically injects X-Manager-Token, handles server IP configuration and timeout

const STORAGE_KEYS = {
  TOKEN: 'tripal_manager_token',
  PROFILE: 'tripal_manager_profile',
  DEVICE_ID: 'tripal_device_id',
  SERVER_URL: 'tripal_server_url'
};

// Default host IP of the PC on the Wi-Fi network
export const DEFAULT_HOST_URL = 'http://192.168.0.230:5000';

// Determine default API base
function getDefaultBaseUrl() {
  const saved = localStorage.getItem(STORAGE_KEYS.SERVER_URL);
  if (saved) return saved;

  // In native Android WebView, window.location is 'http://localhost' or 'capacitor://localhost'
  // Physical phones need the real host PC's Wi-Fi IP
  if (window.location.hostname === 'localhost' && window.location.port !== '5174') {
    return DEFAULT_HOST_URL;
  }
  return DEFAULT_HOST_URL;
}

let API_BASE_URL = getDefaultBaseUrl();

export function setServerUrl(url) {
  API_BASE_URL = url ? url.trim().replace(/\/+$/, '') : DEFAULT_HOST_URL;
  localStorage.setItem(STORAGE_KEYS.SERVER_URL, API_BASE_URL);
  return API_BASE_URL;
}

export function getServerUrl() {
  return API_BASE_URL || DEFAULT_HOST_URL;
}

export function getStoredToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
}

export function getStoredProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId() {
  let devId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!devId) {
    devId = 'dev-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, devId);
  }
  return devId;
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const base = getServerUrl();
  const url = `${base}${endpoint.startsWith('/api') ? endpoint : '/api' + endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Manager-Token': token } : {}),
    ...options.headers,
  };

  const timeoutMs = options.timeout || 7000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.status) throw err;
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Connection timed out (7s). Cannot connect to server at ${base}. Please ensure Phone & PC are on the same Wi-Fi.`);
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    const networkErr = new Error(`Cannot reach server at ${base}. Check Wi-Fi connection and Server IP.`);
    networkErr.isNetworkError = true;
    throw networkErr;
  }
}

export const api = {
  // Server connectivity check
  checkHealth: (targetUrl) => {
    if (targetUrl) {
      const clean = targetUrl.trim().replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      return fetch(`${clean}/api/health`, { signal: controller.signal })
        .then((r) => {
          clearTimeout(timeoutId);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          throw err;
        });
    }
    return request('/api/health', { timeout: 4000 });
  },

  // First-time registration (name is permanently immutable after this)
  registerManager: async (name, phone = '') => {
    const deviceId = getOrCreateDeviceId();
    const data = await request('/api/managers/register', {
      method: 'POST',
      body: JSON.stringify({ name, deviceId, phone }),
      timeout: 8000
    });

    if (data.managerToken) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.managerToken);
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(data));
    }
    return data;
  },

  // Masters required to populate dropdowns (Manager gets sanitized active records, NO stock info)
  getRawMaterials: () => request('/api/masters/raw-materials'),
  getFinishedGoods: () => request('/api/masters/finished-goods'),
  getSuppliers: () => request('/api/masters/suppliers'),
  getCustomers: () => request('/api/masters/customers'),
  getMachines: () => request('/api/masters/machines'),
  getShifts: () => request('/api/masters/shifts'),

  // Production Orders & Consumption batches for selection
  getProductionOrders: () => request('/api/transactions/production-orders'),
  getConsumptionBatches: () => request('/api/transactions/consumption-batches'),

  // Transaction Entries (Manager daily entries)
  createPurchase: (payload) => request('/api/transactions/purchases', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  createConsumptionBatch: (payload) => request('/api/transactions/consumption-batches', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  createProduction: (payload) => request('/api/transactions/production', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  createSale: (payload) => request('/api/transactions/sales', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  createPayment: (payload) => request('/api/accounts/payments', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Staff & Attendance
  getStaff: () => request('/api/masters/staff'),
  getAttendance: (params = '') => request(`/api/attendance${params ? (params.startsWith('?') ? params : `?${params}`) : ''}`),
  saveAttendanceBulk: (payload) => request('/api/attendance/bulk', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getAttendanceSummary: (month = '') => request(`/api/attendance/summary${month ? `?month=${encodeURIComponent(month)}` : ''}`)
};

