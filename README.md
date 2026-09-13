# Tripal Manufacturing ERP System

Complete, production-grade **Tripal Manufacturing ERP System** for a plastic-sheet / tarpaulin manufacturing enterprise.

The system consists of three synchronized tiers:
1. **Backend Engine (`server/`)**: High-performance Node.js REST API with native ACID SQLite transaction-derived stock ledgers and server-side role-based authorization.
2. **Admin Web Management Panel (`client/`)**: Desktop & tablet executive control suite with live stock ledgers, physical reconciliation, multi-filter reporting, manager activity tracking, master data CRUD, and manager activation/deactivation control.
3. **Manager Mobile Android APK (`manager-app/`)**: Real Capacitor-powered native Android application (`com.tripal.manager`) restricted strictly to **ENTRY ONLY** with permanent manager-device binding, zero stock exposure, and multi-output production balance validation.

---

## 1. Security & Role Architecture

| Feature / Domain | Admin Web Panel | Manager Mobile App (APK) | Backend Enforcement |
| :--- | :--- | :--- | :--- |
| **Executive Dashboard & KPIs** | Full Visibility | **DENIED** | `HTTP 403 Forbidden` |
| **Raw Material Stock** | Live Balance & Min Alerts | **DENIED** | `HTTP 403 Forbidden` |
| **Finished Goods Stock** | Live Specs & Balances | **DENIED** | `HTTP 403 Forbidden` |
| **Stock Movement Ledger** | Full Chronological Audit | **DENIED** | `HTTP 403 Forbidden` |
| **Stock Reconciliation** | Physical vs System Adjustments | **DENIED** | `HTTP 403 Forbidden` |
| **Reports (Wastage, Sales)** | Multi-filter Drilldown + CSV | **DENIED** | `HTTP 403 Forbidden` |
| **Audit Logs** | Complete History | **DENIED** | `HTTP 403 Forbidden` |
| **Manager Activity Report** | Per-Manager Performance | **DENIED** | `HTTP 403 Forbidden` |
| **Masters CRUD** | Create, Edit, Toggle, Delete | **DENIED** | `HTTP 403 Forbidden` |
| **Manager Activation / Deactivation** | Toggle Active/Inactive | **DENIED** | `HTTP 403 Forbidden` |
| **Raw Material Purchase Entry** | Allowed | **ALLOWED** | Auto-attributed to Manager |
| **Production Batch Entry** | Allowed | **ALLOWED** | Multi-output + Balance Meter |
| **Sales Dispatch Entry** | Allowed | **ALLOWED** | Auto-attributed to Manager |
| **Form Dropdown Data** | All Active + Stock Info | **Sanitized Active Only** | Zero stock numbers exposed |

### Manager Identity Immutability
- **First Launch**: Prompted for full name (and optional phone).
- **Backend Registration**: Issues a permanent UUID/cryptographic `manager_token` and binds the device ID.
- **Permanent Lock**: Name cannot be switched, edited, or logged out.
- **Tamper-Proof Attribution**: The backend automatically overwrites `manager_name`, `manager_id`, and `device_id` on all transactions using the authenticated token.
- **Admin Deactivation**: If an Admin deactivates a manager from Masters, the APK immediately blocks new submissions with `HTTP 403 Forbidden`.

---

## 2. Quick Start & Running Locally

### Prerequisites
- Node.js v24+
- Java 17+ (or Android Studio JBR)
- Android SDK (for building the native APK)

### Installation
```bash
# 1. Install root dependencies
npm install

# 2. Install client dependencies
npm install --prefix client

# 3. Install manager mobile app dependencies
npm install --prefix manager-app
```

### Start Development Servers
```bash
npm run dev
```
This runs concurrently:
- **Express Backend**: `http://localhost:5000`
- **Admin Web Panel**: `http://localhost:5173`
- **Manager Mobile App**: `http://localhost:5174`

### Admin Login Credentials
When accessing `http://localhost:5173`, authenticate using:
- **Admin ID**: `admin`
- **Password**: `admin123`

---

## 3. Building the Deliverables

### A. Build Web Applications (0 Errors)
```bash
npm run build
```
Builds both `client` (Admin Panel) and `manager-app` (Manager Mobile Web) into their respective `dist/` folders.

### B. Build Real Android APK (`.apk`)
```bash
npm run build:apk
```
Or manually run:
```bash
cd manager-app
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```
The compiled APK is output to:
```
manager-app/android/app/build/outputs/apk/debug/app-debug.apk
```

### C. Install APK on Android Device / Emulator
Ensure your device is connected via USB with USB debugging enabled or an emulator is running:
```bash
adb install -r manager-app/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Business Logic & Validation

- **Production Balance Equation**:
  $$\text{Total Finished Goods Output (KG)} + \text{Wastage (KG)} = \text{Raw Material Used (KG)}$$
  Any mismatch greater than 0.05 KG is rejected by both the mobile balance meter and the backend (`HTTP 400 Bad Request`). No partial records are ever committed.
- **Transaction-Derived Stock**:
  Stock balances are calculated purely from credit/debit movements in `raw_material_movements` and `finished_goods_movements`. Manual stock overwrite is strictly disallowed.
- **Stock Guard**:
  - Production consumption cannot exceed available Raw Material stock.
  - Sales dispatches cannot exceed available Finished Goods stock for the selected specification.

---

## 5. Security & Verification Tests

To run the automated verification test suite:
```bash
node -e "
const token = 'mgr_rahul_i8xiocxt'; // Active manager token
fetch('http://localhost:5000/api/inventory/raw-materials', { headers: { 'X-Manager-Token': token } })
  .then(r => console.log('Manager Stock Access -> Status:', r.status)); // Returns 403
"
```
