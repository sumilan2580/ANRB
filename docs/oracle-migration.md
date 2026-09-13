# TRIPAL ERP — Oracle Autonomous AI Database Always Free Migration Guide

This guide details the complete architecture, provisioning, migration, verification, and ongoing operations for running the **Tripal / Plastic Sheet Manufacturing ERP** on **Oracle Autonomous AI Database (Always Free)**.

---

## 1. Architecture Overview

### Prior Architecture (SQLite)
- Backend: Node.js 22 + Express (synchronous `node:sqlite` DatabaseSync)
- Database: Local single-file `tripal_erp.sqlite` with WAL mode
- Single-process concurrency, file locking limitations, local disk dependence

### New Production Architecture (Oracle Autonomous AI Database)
- **Database Engine**: Oracle Autonomous AI Database Always Free (Transaction Processing / ATP)
- **Driver**: Official `oracledb` Node.js driver with built-in Connection Pooling (`oracledb.createPool`)
- **Mode**: Supports both **Thin Mode** (pure JS, zero native binaries) and **Thick Mode** (Oracle Instant Client with mTLS wallet)
- **Security**:
  - Encrypted mTLS (Mutual TLS) connection via Oracle Cloud Wallet
  - Strict separation of credentials via environment variables (`.env`)
  - No database credentials exposed to frontend
  - Server-side role-based access control (RBAC): Manager role restricted from any `PUT`, `PATCH`, or `DELETE` with HTTP 403
- **Data Model**:
  - 24 normalized tables
  - `NUMBER GENERATED ALWAYS AS IDENTITY` primary keys
  - Sequence-backed thread-safe business code generation (`PUR-000001`, `SALE-000001`, `INV-2026-000001`, etc.)
  - Partial unique index on `invoice_number` (excluding voided invoices)
  - `NUMBER(18,2)` for financial fields, `NUMBER(18,3)` for quantities

---

## 2. Step-by-Step Oracle Cloud (OCI) Provisioning

### Step 2.1: Create Autonomous Database in OCI
1. Log in to your [Oracle Cloud Console](https://cloud.oracle.com).
2. Open the navigation menu: **Oracle Database** &rarr; **Autonomous Database**.
3. Click **Create Autonomous Database**.
4. Configure the instance:
   - **Display Name**: `TRIPAL_ERP_DB`
   - **Database Name**: `TRIPALERP`
   - **Workload Type**: `Transaction Processing` (or `Autonomous JSON Database`)
   - **Deployment Type**: `Shared Infrastructure`
   - **Always Free**: **Toggle ON** (ensures 100% free tier: 1 OCPU, 20 GB storage)
   - **Database Version**: `19c` or `23ai`
   - **Administrator Credentials**:
     - Username: `ADMIN`
     - Password: Set a strong password (12+ characters, uppercase, lowercase, numbers, special characters)
   - **Network Access**: `Secure access from everywhere` (or restrict to your application server IP)
   - **License Type**: `License Included`
5. Click **Create Autonomous Database**. Provisioning completes in ~2 minutes.

### Step 2.2: Download Client Credentials (Wallet)
1. On the Autonomous Database Details page, click **Database Connection**.
2. Under **Download client credentials (Wallets)**, click **Download Wallet**.
3. Enter a wallet password (remember this password for `ORACLE_WALLET_PASSWORD`).
4. Download the `Wallet_TRIPALERP.zip` file.
5. Extract the zip contents into a secure directory on your server:
   ```bash
   mkdir -p /opt/oracle/wallet
   unzip Wallet_TRIPALERP.zip -d /opt/oracle/wallet
   chmod 700 /opt/oracle/wallet
   ```
   *Note: On Windows, extract to a path like `C:\oracle\wallet`.*

6. Inspect `tnsnames.ora` inside the wallet folder. You will see connection aliases such as:
   - `tripalerp_high` (highest resources, batch jobs)
   - `tripalerp_medium` (recommended for ERP web transactions)
   - `tripalerp_low` (lowest priority, reporting)

---

## 3. Environment Configuration (`.env`)

Create or update your `.env` file in the project root:

```env
# =============================================================================
# TRIPAL ERP — PRODUCTION ORACLE CONFIGURATION
# =============================================================================

# Server Port & Environment
PORT=5000
NODE_ENV=production

# Set DB_CLIENT to 'oracle' for production (or omit; default is oracle when credentials exist)
DB_CLIENT=oracle

# Oracle Database User (ADMIN or dedicated ERP schema user)
ORACLE_USER=ADMIN
ORACLE_PASSWORD=YourStrongOraclePassword123#

# Oracle Connection Alias (from tnsnames.ora) or Full Easy Connect / TNS String
ORACLE_CONNECT_STRING=tripalerp_medium

# Path to directory containing extracted Oracle Wallet files (cwallet.sso, tnsnames.ora, sqlnet.ora)
ORACLE_WALLET_LOCATION=C:/oracle/wallet
ORACLE_WALLET_PASSWORD=YourWalletPassword123#

# Oracle Connection Pool Tuning (Always Free limits: max 20 sessions across all apps)
ORACLE_POOL_MIN=1
ORACLE_POOL_MAX=5
ORACLE_POOL_INCREMENT=1
ORACLE_POOL_TIMEOUT=60
```

> **Thin Mode vs Thick Mode**:
> - **Thin Mode (Default)**: If using standard TLS connections without client certificates, `oracledb` connects directly without any Oracle Instant Client installation.
> - **Thick Mode (Recommended for Autonomous DB with mTLS)**: Install [Oracle Instant Client Basic](https://www.oracle.com/database/technologies/instant-client.html) and configure the wallet path as shown above.

---

## 4. Schema Creation & Data Migration

### Step 4.1: Deploy Oracle Schema DDL
Execute the schema creation script using either SQLcl, SQL Developer, or the OCI Database Actions web console:

```bash
# Using SQLcl
sql ADMIN/YourStrongPassword@tripalerp_medium @scripts/oracle-schema.sql
```
*Or open `scripts/oracle-schema.sql`, copy all contents, and execute in the OCI Database Actions Web SQL worksheet.*

This creates:
- All 24 tables with identity columns and foreign keys
- 13 sequences for business code generation
- Partial unique indexes
- Initial company settings and default administrator account

### Step 4.2: Validate with Dry-Run Migration
Before transferring live data, run the migration in dry-run mode to verify data types and row counts:

```bash
npm run migrate:dry
```

### Step 4.3: Execute Full Data Migration
Transfer all data from `tripal_erp.sqlite` to Oracle:

```bash
npm run migrate
```

The migration script:
1. Creates an automatic timestamped safety backup of `tripal_erp.sqlite`.
2. Reads all rows across all 24 tables in foreign-key dependency order.
3. Inserts all rows preserving original IDs via `OVERRIDING SYSTEM VALUE`.
4. Resets identity sequences to `MAX(id) + 1` so future inserts do not conflict.
5. Reconciles financial balances (purchases total, sales total, payments total) and stock ledger balances.
6. Outputs a verification table.

---

## 5. Post-Migration Verification

Run the automated verification suite to validate that all tables, sequences, and constraints are operational in Oracle:

```bash
npm run verify:oracle
```

Expected output:
- `All 24 tables present: PASS`
- `All 13 sequences present: PASS`
- `Zero duplicate invoice numbers: PASS`
- `Reconciled stock and financial balances: PASS`

Run live API verification:
```bash
npm run test:smoke
npm run test:requirements
```

---

## 6. Ten Known Production Bugs Fixed

| Bug # | Description | Root Cause | Solution Implemented |
|---|---|---|---|
| **Bug 1** | `c.city` column error in GST invoice | `customers` table had `city` added later via SQLite alter table | Oracle schema includes `city`, `state`, `pincode`, and `state_code` directly in `customers` table DDL. Queries alias correctly. |
| **Bug 2** | Customer Ledger blank | Date filtering boundary issues and missing JOIN defaults | Customer ledger query uses `TRUNC(created_at)` and coalesces nulls; opening balance calculation verified. |
| **Bug 3** | Duplicate invoice numbers | Concurrency race condition on code counter | Function-based unique index on `sales(invoice_number)` for non-voided sales; sequence-backed collision-safe generation. |
| **Bug 4** | Cash sale auto-receipt | Legacy logic auto-inserted a payment record | Verified: Cash sales record the sale header only; payments must be explicitly entered through the payments API. |
| **Bug 5** | Single raw material purchase | Single item fields on purchase header | Multi-item architecture using `purchase_items` table with item-level HSN, GST, rate, and quantity. |
| **Bug 6** | Only KG raw materials | Schema hardcoded unit to KG | Added `unit` column (`KG`, `PCS`, `MTR`, `NOS`, `SET`) to `raw_materials`, `purchase_items`, and `consumption_batch_items`. |
| **Bug 7** | Production re-enters RM | Unlinked manual re-entry | Production batches link directly to `consumption_batch_id`, pulling issued materials automatically without duplicate stock deduction. |
| **Bug 8** | Bank dropdown hardcoded | Hardcoded values in frontend | Backed by settings table (`bank_name`, `bank_account_no`, `bank_ifsc`, `bank_branch`) and dynamic payment modes. |
| **Bug 9** | Admin edit/delete safety | Hard deletes destroyed financial audit trails | Soft-delete architecture using `is_voided`, `voided_at`, `voided_by`, and `void_reason`, with stock reversal and audit logging. |
| **Bug 10** | Manager web restrictions | Managers could send PUT/DELETE requests | `authenticateRole` and `requireAdmin` middlewares enforce entry-only permissions: Manager role gets HTTP 403 on all `PUT`, `PATCH`, and `DELETE`. |

---

## 7. Production Operations & Maintenance

### Starting the Production ERP
```bash
# Production server start
npm run server
```

### Regular Logical Backups
To export all 24 tables to structured JSON archives for disaster recovery:
```bash
npm run export:data
```
Outputs to `exports/backup_<timestamp>/` with an integrity manifest.

### Connection Pool Best Practices for Always Free
- Keep `ORACLE_POOL_MAX` at `5` to stay well within Always Free session thresholds (max 20 concurrent sessions).
- The pool automatically drains idle connections after `ORACLE_POOL_TIMEOUT` seconds.

### Troubleshooting Guide

- **`ORA-12154: TNS:could not resolve the connect identifier specified`**:
  - Verify that `ORACLE_WALLET_LOCATION` points to the folder containing `tnsnames.ora`.
  - Ensure the connection string matches an alias inside `tnsnames.ora` (e.g. `tripalerp_medium`).
- **`ORA-01017: invalid username/password`**:
  - Confirm `ORACLE_USER` (usually `ADMIN`) and password in `.env`.
- **`ORA-00001: unique constraint violated`**:
  - Occurs if an existing code or invoice number is reused. Sequences automatically prevent this; check if manual IDs were inserted.
- **`DPI-1047: Cannot locate a 64-bit Oracle Client library`**:
  - If using Thick Mode with wallet, ensure Oracle Instant Client 64-bit is installed and in your system `PATH`.
  - Alternatively, if connecting via Thin Mode, Instant Client is not required.
