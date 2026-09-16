-- =============================================================================
-- TRIPAL ERP — Layerbase PostgreSQL Schema
-- Target: Layerbase Managed PostgreSQL Database
-- =============================================================================
-- 24 tables with exact schema, foreign keys, constraints, and indexes.
-- Preserves all primary keys, decimal precisions, and business invariants.
-- =============================================================================

-- =============================================================================
-- TABLE 1: users
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'manager')),
    name            VARCHAR(200),
    session_token   VARCHAR(200),
    manager_id      INTEGER,
    status          VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    permissions     TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =============================================================================
-- TABLE 2: managers
-- =============================================================================
CREATE TABLE IF NOT EXISTS managers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL UNIQUE,
    device_id       VARCHAR(200),
    phone           VARCHAR(30),
    status          VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    manager_token   VARCHAR(200) UNIQUE,
    permissions     TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- TABLE 3: raw_materials
-- =============================================================================
CREATE TABLE IF NOT EXISTS raw_materials (
    id               SERIAL PRIMARY KEY,
    code             VARCHAR(50)  NOT NULL UNIQUE,
    name             VARCHAR(300) NOT NULL UNIQUE,
    category         VARCHAR(100) NOT NULL,
    unit             VARCHAR(20)  DEFAULT 'KG' NOT NULL CHECK (unit IN ('KG', 'PCS', 'MTR', 'LTR', 'NOS', 'SET')),
    min_stock_alert  NUMERIC(18,3) DEFAULT 1000,
    hsn_code         VARCHAR(20)  DEFAULT '3901',
    gst_percent      NUMERIC(8,4) DEFAULT 18,
    status           VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_status ON raw_materials(status);

-- =============================================================================
-- TABLE 4: suppliers
-- =============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id                    SERIAL PRIMARY KEY,
    supplier_code         VARCHAR(50),
    name                  VARCHAR(300) NOT NULL UNIQUE,
    phone                 VARCHAR(30),
    email                 VARCHAR(200),
    address               VARCHAR(500),
    city                  VARCHAR(100) DEFAULT 'Ahmedabad',
    state                 VARCHAR(100) DEFAULT 'Gujarat',
    pincode               VARCHAR(20)  DEFAULT '382445',
    state_code            VARCHAR(10)  DEFAULT '24',
    gst_number            VARCHAR(20),
    supplier_type         VARCHAR(50)  DEFAULT 'GST Registered',
    opening_balance       NUMERIC(18,2) DEFAULT 0,
    opening_balance_type  VARCHAR(20)  DEFAULT 'Credit' CHECK (opening_balance_type IN ('Debit', 'Credit', 'DEBIT', 'CREDIT')),
    status                VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- =============================================================================
-- TABLE 5: customers
-- =============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id                    SERIAL PRIMARY KEY,
    customer_code         VARCHAR(50),
    name                  VARCHAR(300) NOT NULL UNIQUE,
    phone                 VARCHAR(30),
    email                 VARCHAR(200),
    address               VARCHAR(500),
    billing_address       VARCHAR(500),
    shipping_address      VARCHAR(500),
    city                  VARCHAR(100) DEFAULT 'Ahmedabad',
    state                 VARCHAR(100) DEFAULT 'Gujarat',
    pincode               VARCHAR(20)  DEFAULT '382445',
    state_code            VARCHAR(10)  DEFAULT '24',
    gst_number            VARCHAR(20),
    customer_type         VARCHAR(50)  DEFAULT 'GST Registered',
    opening_balance       NUMERIC(18,2) DEFAULT 0,
    opening_balance_type  VARCHAR(20)  DEFAULT 'Debit' CHECK (opening_balance_type IN ('Debit', 'Credit', 'DEBIT', 'CREDIT')),
    remarks               VARCHAR(500),
    status                VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- =============================================================================
-- TABLE 6: machines
-- =============================================================================
CREATE TABLE IF NOT EXISTS machines (
    id                   SERIAL PRIMARY KEY,
    machine_code         VARCHAR(50)  NOT NULL UNIQUE,
    name                 VARCHAR(200) NOT NULL,
    capacity_kg_per_day  NUMERIC(18,3) DEFAULT 5000,
    status               VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- TABLE 7: shifts
-- =============================================================================
CREATE TABLE IF NOT EXISTS shifts (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    start_time  VARCHAR(20),
    end_time    VARCHAR(20),
    status      VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- TABLE 8: finished_products
-- =============================================================================
CREATE TABLE IF NOT EXISTS finished_products (
    id               SERIAL PRIMARY KEY,
    product_code     VARCHAR(50)  NOT NULL UNIQUE,
    product_name     VARCHAR(200) DEFAULT 'Tripal',
    gsm              INTEGER      NOT NULL,
    width_size       VARCHAR(50)  NOT NULL,
    length_val       VARCHAR(50),
    colour           VARCHAR(50)  NOT NULL,
    grade            VARCHAR(50)  DEFAULT 'Grade A',
    unit             VARCHAR(20)  DEFAULT 'KG',
    min_stock_alert  NUMERIC(18,3) DEFAULT 500,
    hsn_code         VARCHAR(20)  DEFAULT '3926',
    gst_percent      NUMERIC(8,4) DEFAULT 18,
    status           VARCHAR(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_finished_products_status ON finished_products(status);

-- =============================================================================
-- TABLE 9: production_orders
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_orders (
    id                   SERIAL PRIMARY KEY,
    order_no             VARCHAR(50)  NOT NULL UNIQUE,
    order_date           VARCHAR(20)  NOT NULL,
    customer_id          INTEGER      NOT NULL REFERENCES customers(id),
    customer_order_no    VARCHAR(100),
    finished_product_id  INTEGER      NOT NULL REFERENCES finished_products(id),
    gsm                  INTEGER,
    size                 VARCHAR(50),
    required_quantity    NUMERIC(18,3) NOT NULL,
    unit                 VARCHAR(20)  DEFAULT 'KG',
    delivery_date        VARCHAR(20),
    remarks              VARCHAR(500),
    status               VARCHAR(30)  DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Production', 'Completed', 'Cancelled')),
    created_by           VARCHAR(200) DEFAULT 'Admin',
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_production_orders_customer ON production_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_date ON production_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);

-- =============================================================================
-- TABLE 10: consumption_batches  (Material Issue Batches)
-- =============================================================================
CREATE TABLE IF NOT EXISTS consumption_batches (
    id                   SERIAL PRIMARY KEY,
    batch_no             VARCHAR(50)  NOT NULL UNIQUE,
    date                 VARCHAR(20)  NOT NULL,
    production_order_id  INTEGER      REFERENCES production_orders(id),
    machine_id           INTEGER      REFERENCES machines(id),
    shift_id             INTEGER      REFERENCES shifts(id),
    manager_id           INTEGER,
    manager_name         VARCHAR(200) NOT NULL,
    device_id            VARCHAR(200),
    status               VARCHAR(20)  DEFAULT 'Issued' CHECK (status IN ('Draft', 'Issued', 'Completed', 'Cancelled')),
    remarks              VARCHAR(500),
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cb_date ON consumption_batches(date);
CREATE INDEX IF NOT EXISTS idx_cb_machine ON consumption_batches(machine_id);
CREATE INDEX IF NOT EXISTS idx_cb_status ON consumption_batches(status);
CREATE INDEX IF NOT EXISTS idx_cb_manager ON consumption_batches(manager_name);

-- =============================================================================
-- TABLE 11: consumption_batch_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS consumption_batch_items (
    id                    SERIAL PRIMARY KEY,
    consumption_batch_id  INTEGER      NOT NULL REFERENCES consumption_batches(id) ON DELETE CASCADE,
    raw_material_id       INTEGER      NOT NULL REFERENCES raw_materials(id),
    quantity              NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
    unit                  VARCHAR(20)  DEFAULT 'KG' NOT NULL,
    batch_lot             VARCHAR(100),
    remarks               VARCHAR(500),
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cbi_batch ON consumption_batch_items(consumption_batch_id);
CREATE INDEX IF NOT EXISTS idx_cbi_raw_material ON consumption_batch_items(raw_material_id);

-- =============================================================================
-- TABLE 12: raw_material_purchases  (Purchase Header)
-- =============================================================================
CREATE TABLE IF NOT EXISTS raw_material_purchases (
    id                SERIAL PRIMARY KEY,
    purchase_code     VARCHAR(50)  NOT NULL UNIQUE,
    date              VARCHAR(20)  NOT NULL,
    supplier_id       INTEGER      NOT NULL REFERENCES suppliers(id),
    raw_material_id   INTEGER      REFERENCES raw_materials(id),
    quantity_kg       NUMERIC(18,3) DEFAULT 0,
    rate_per_kg       NUMERIC(18,4) DEFAULT 0,
    taxable_amount    NUMERIC(18,2) DEFAULT 0,
    gst_percent       NUMERIC(8,4) DEFAULT 18,
    cgst_amount       NUMERIC(18,2) DEFAULT 0,
    sgst_amount       NUMERIC(18,2) DEFAULT 0,
    igst_amount       NUMERIC(18,2) DEFAULT 0,
    total_amount      NUMERIC(18,2) DEFAULT 0,
    purchase_type     VARCHAR(20)  DEFAULT 'GST' CHECK (purchase_type IN ('GST', 'NON_GST')),
    discount_amount   NUMERIC(18,2) DEFAULT 0,
    other_charges     NUMERIC(18,2) DEFAULT 0,
    round_off         NUMERIC(18,2) DEFAULT 0,
    payment_mode      VARCHAR(30)  DEFAULT 'Credit',
    invoice_number    VARCHAR(100),
    remarks           VARCHAR(500),
    manager_id        INTEGER,
    manager_name      VARCHAR(200) NOT NULL,
    device_id         VARCHAR(200),
    is_voided         SMALLINT     DEFAULT 0 NOT NULL CHECK (is_voided IN (0, 1)),
    voided_at         TIMESTAMP,
    voided_by         VARCHAR(200),
    void_reason       VARCHAR(500),
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_date ON raw_material_purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON raw_material_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_voided ON raw_material_purchases(is_voided);
CREATE INDEX IF NOT EXISTS idx_purchases_manager ON raw_material_purchases(manager_name);

-- =============================================================================
-- TABLE 13: purchase_items  (Purchase Line Items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id               SERIAL PRIMARY KEY,
    purchase_id      INTEGER      NOT NULL REFERENCES raw_material_purchases(id) ON DELETE CASCADE,
    raw_material_id  INTEGER      NOT NULL REFERENCES raw_materials(id),
    quantity         NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
    unit             VARCHAR(20)  DEFAULT 'KG' NOT NULL,
    rate             NUMERIC(18,4) NOT NULL,
    discount         NUMERIC(18,2) DEFAULT 0,
    hsn_code         VARCHAR(20),
    gst_percent      NUMERIC(8,4) DEFAULT 0,
    taxable_amount   NUMERIC(18,2) NOT NULL,
    gst_amount       NUMERIC(18,2) DEFAULT 0,
    cgst_amount      NUMERIC(18,2) DEFAULT 0,
    sgst_amount      NUMERIC(18,2) DEFAULT 0,
    igst_amount      NUMERIC(18,2) DEFAULT 0,
    total_amount     NUMERIC(18,2) NOT NULL,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pi_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_pi_raw_material ON purchase_items(raw_material_id);

-- =============================================================================
-- TABLE 14: raw_material_movements  (RM Stock Ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS raw_material_movements (
    id               SERIAL PRIMARY KEY,
    movement_type    VARCHAR(50)  NOT NULL,
    reference_type   VARCHAR(50)  NOT NULL,
    reference_id     VARCHAR(100) NOT NULL,
    raw_material_id  INTEGER      NOT NULL REFERENCES raw_materials(id),
    quantity_change  NUMERIC(18,3) NOT NULL,
    unit             VARCHAR(20)  DEFAULT 'KG',
    balance_after    NUMERIC(18,3) NOT NULL,
    manager_name     VARCHAR(200),
    remarks          VARCHAR(500),
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rmm_raw_material ON raw_material_movements(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_rmm_reference ON raw_material_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_rmm_created_at ON raw_material_movements(created_at);

-- =============================================================================
-- TABLE 15: production_batches  (Production Header)
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_batches (
    id                    SERIAL PRIMARY KEY,
    batch_code            VARCHAR(50)  NOT NULL UNIQUE,
    date                  VARCHAR(20)  NOT NULL,
    machine_id            INTEGER      REFERENCES machines(id),
    shift_id              INTEGER      REFERENCES shifts(id),
    raw_material_id       INTEGER      REFERENCES raw_materials(id),
    raw_material_used_kg  NUMERIC(18,3) DEFAULT 0,
    total_finished_kg     NUMERIC(18,3) DEFAULT 0 NOT NULL,
    total_wastage_kg      NUMERIC(18,3) DEFAULT 0 NOT NULL,
    wastage_unit          VARCHAR(20)  DEFAULT 'KG',
    wastage_reason        VARCHAR(200),
    remarks               VARCHAR(500),
    manager_id            INTEGER,
    manager_name          VARCHAR(200) DEFAULT 'Admin' NOT NULL,
    device_id             VARCHAR(200),
    production_order_id   INTEGER      REFERENCES production_orders(id),
    consumption_batch_id  INTEGER      REFERENCES consumption_batches(id),
    is_voided             SMALLINT     DEFAULT 0 NOT NULL CHECK (is_voided IN (0, 1)),
    voided_at             TIMESTAMP,
    voided_by             VARCHAR(200),
    void_reason           VARCHAR(500),
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pb_date ON production_batches(date);
CREATE INDEX IF NOT EXISTS idx_pb_machine ON production_batches(machine_id);
CREATE INDEX IF NOT EXISTS idx_pb_consumption ON production_batches(consumption_batch_id);
CREATE INDEX IF NOT EXISTS idx_pb_voided ON production_batches(is_voided);
CREATE INDEX IF NOT EXISTS idx_pb_manager ON production_batches(manager_name);

-- =============================================================================
-- TABLE 16: production_outputs  (Production Line Items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_outputs (
    id                   SERIAL PRIMARY KEY,
    batch_id             INTEGER      NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    finished_product_id  INTEGER      NOT NULL REFERENCES finished_products(id),
    gsm                  INTEGER,
    width_size           VARCHAR(50),
    length_val           VARCHAR(50),
    colour               VARCHAR(50),
    grade                VARCHAR(50),
    quantity_kg          NUMERIC(18,3) NOT NULL CHECK (quantity_kg > 0),
    unit                 VARCHAR(20)  DEFAULT 'KG',
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_po_batch ON production_outputs(batch_id);
CREATE INDEX IF NOT EXISTS idx_po_finished_product ON production_outputs(finished_product_id);

-- =============================================================================
-- TABLE 17: finished_goods_movements  (FG Stock Ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS finished_goods_movements (
    id                   SERIAL PRIMARY KEY,
    movement_type        VARCHAR(50)  NOT NULL,
    reference_type       VARCHAR(50)  NOT NULL,
    reference_id         VARCHAR(100) NOT NULL,
    finished_product_id  INTEGER      NOT NULL REFERENCES finished_products(id),
    quantity_change      NUMERIC(18,3) NOT NULL,
    unit                 VARCHAR(20)  DEFAULT 'KG',
    balance_after        NUMERIC(18,3) NOT NULL,
    manager_name         VARCHAR(200),
    remarks              VARCHAR(500),
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fgm_finished_product ON finished_goods_movements(finished_product_id);
CREATE INDEX IF NOT EXISTS idx_fgm_reference ON finished_goods_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_fgm_created_at ON finished_goods_movements(created_at);

-- =============================================================================
-- TABLE 18: sales  (Sales Header)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales (
    id                   SERIAL PRIMARY KEY,
    sale_code            VARCHAR(50)  NOT NULL UNIQUE,
    invoice_number       VARCHAR(100),
    date                 VARCHAR(20)  NOT NULL,
    customer_id          INTEGER      NOT NULL REFERENCES customers(id),
    finished_product_id  INTEGER      REFERENCES finished_products(id),
    quantity_kg          NUMERIC(18,3) DEFAULT 0,
    rate_per_kg          NUMERIC(18,4) DEFAULT 0,
    taxable_amount       NUMERIC(18,2) DEFAULT 0,
    gst_percent          NUMERIC(8,4) DEFAULT 18,
    cgst_amount          NUMERIC(18,2) DEFAULT 0,
    sgst_amount          NUMERIC(18,2) DEFAULT 0,
    igst_amount          NUMERIC(18,2) DEFAULT 0,
    total_amount         NUMERIC(18,2) DEFAULT 0,
    sales_type           VARCHAR(20)  DEFAULT 'GST' CHECK (sales_type IN ('GST', 'NON_GST')),
    payment_type         VARCHAR(30)  DEFAULT 'Cash',
    customer_gstin       VARCHAR(20),
    billing_address      VARCHAR(500),
    shipping_address     VARCHAR(500),
    discount_amount      NUMERIC(18,2) DEFAULT 0,
    other_charges        NUMERIC(18,2) DEFAULT 0,
    round_off            NUMERIC(18,2) DEFAULT 0,
    remarks              VARCHAR(500),
    manager_id           INTEGER,
    manager_name         VARCHAR(200) NOT NULL,
    device_id            VARCHAR(200),
    is_voided            SMALLINT     DEFAULT 0 NOT NULL CHECK (is_voided IN (0, 1)),
    voided_at            TIMESTAMP,
    voided_by            VARCHAR(200),
    void_reason          VARCHAR(500),
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Partial unique index: only active, non-voided invoices must be unique
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_number
    ON sales (invoice_number)
    WHERE is_voided = 0 AND invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_voided ON sales(is_voided);
CREATE INDEX IF NOT EXISTS idx_sales_manager ON sales(manager_name);

-- =============================================================================
-- TABLE 19: sales_items  (Sales Line Items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales_items (
    id                   SERIAL PRIMARY KEY,
    sale_id              INTEGER      NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    finished_product_id  INTEGER      NOT NULL REFERENCES finished_products(id),
    gsm                  INTEGER,
    size                 VARCHAR(50),
    hsn_code             VARCHAR(20),
    quantity             NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
    unit                 VARCHAR(20)  DEFAULT 'KG' NOT NULL,
    rate                 NUMERIC(18,4) NOT NULL,
    discount             NUMERIC(18,2) DEFAULT 0,
    gst_percent          NUMERIC(8,4) DEFAULT 0,
    taxable_amount       NUMERIC(18,2) NOT NULL,
    gst_amount           NUMERIC(18,2) DEFAULT 0,
    cgst_amount          NUMERIC(18,2) DEFAULT 0,
    sgst_amount          NUMERIC(18,2) DEFAULT 0,
    igst_amount          NUMERIC(18,2) DEFAULT 0,
    total_amount         NUMERIC(18,2) NOT NULL,
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_si_sale ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_si_finished_product ON sales_items(finished_product_id);

-- =============================================================================
-- TABLE 20: wastage_records
-- =============================================================================
CREATE TABLE IF NOT EXISTS wastage_records (
    id                   SERIAL PRIMARY KEY,
    date                 VARCHAR(20)  NOT NULL,
    production_id        INTEGER,
    production_no        VARCHAR(50)  NOT NULL,
    production_order_id  INTEGER,
    product_id           INTEGER,
    quantity             NUMERIC(18,3) NOT NULL,
    unit                 VARCHAR(20)  DEFAULT 'KG',
    reason               VARCHAR(200),
    manager_name         VARCHAR(200),
    machine_id           INTEGER,
    remarks              VARCHAR(500),
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wastage_production ON wastage_records(production_id);
CREATE INDEX IF NOT EXISTS idx_wastage_date ON wastage_records(date);

-- =============================================================================
-- TABLE 21: payments  (Customer Receipts + Supplier Payments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id             SERIAL PRIMARY KEY,
    payment_code   VARCHAR(50)  NOT NULL UNIQUE,
    date           VARCHAR(20)  NOT NULL,
    party_type     VARCHAR(20)  NOT NULL CHECK (party_type IN ('CUSTOMER', 'SUPPLIER')),
    party_id       INTEGER      NOT NULL,
    amount         NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    payment_mode   VARCHAR(30)  DEFAULT 'Bank',
    reference_no   VARCHAR(200),
    remarks        VARCHAR(500),
    against_type   VARCHAR(30)  DEFAULT 'ON_ACCOUNT',
    invoice_id     INTEGER,
    created_by     VARCHAR(200) DEFAULT 'Admin',
    manager_id     INTEGER,
    manager_name   VARCHAR(200),
    device_id      VARCHAR(200),
    is_voided      SMALLINT     DEFAULT 0 NOT NULL CHECK (is_voided IN (0, 1)),
    voided_at      TIMESTAMP,
    voided_by      VARCHAR(200),
    void_reason    VARCHAR(500),
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_voided ON payments(is_voided);

-- =============================================================================
-- TABLE 22: stock_adjustments  (Inventory Reconciliation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id                    SERIAL PRIMARY KEY,
    adjustment_code       VARCHAR(50)  NOT NULL UNIQUE,
    date                  VARCHAR(20)  NOT NULL,
    item_type             VARCHAR(30)  NOT NULL CHECK (item_type IN ('RAW_MATERIAL', 'FINISHED_GOOD')),
    item_id               INTEGER      NOT NULL,
    system_quantity_kg    NUMERIC(18,3) NOT NULL,
    physical_quantity_kg  NUMERIC(18,3) NOT NULL,
    difference_kg         NUMERIC(18,3) NOT NULL,
    status                VARCHAR(20)  NOT NULL CHECK (status IN ('MATCHED', 'SHORT', 'EXCESS')),
    reason                VARCHAR(500),
    adjusted_by           VARCHAR(200) NOT NULL,
    device_id             VARCHAR(200),
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_adj_date ON stock_adjustments(date);
CREATE INDEX IF NOT EXISTS idx_adj_item ON stock_adjustments(item_type, item_id);

-- =============================================================================
-- TABLE 23: audit_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id               SERIAL PRIMARY KEY,
    entity_type      VARCHAR(50)  NOT NULL,
    entity_id        VARCHAR(100) NOT NULL,
    action           VARCHAR(50)  NOT NULL,
    original_values  TEXT,
    new_values       TEXT,
    performed_by     VARCHAR(200),
    device_id        VARCHAR(200),
    timestamp        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- =============================================================================
-- TABLE 24: settings  (Company & Application Settings — Key-Value)
-- =============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- TABLE 25: expense_heads
-- =============================================================================
CREATE TABLE IF NOT EXISTS expense_heads (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(20) DEFAULT 'EXPENSE' NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
    category        VARCHAR(100) DEFAULT 'Direct Expense',
    status          VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_heads_type ON expense_heads(type);
CREATE INDEX IF NOT EXISTS idx_expense_heads_status ON expense_heads(status);

-- =============================================================================
-- DEFAULT COMPANY SETTINGS & MASTER ADMIN
-- (Inserted only if not already present)
-- =============================================================================
INSERT INTO settings (key, value) VALUES ('company_name',       'TRIPAL MANUFACTURING PVT. LTD.') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_address',    'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_gstin',      '24AAACT1234F1Z5') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_state',      'Gujarat') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_state_code', '24') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_city',       'Ahmedabad') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_pincode',    '382445') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_phone',      '+91 79 2583 0000') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('company_email',      'accounts@tripalmanufacturing.com') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('bank_name',          'State Bank of India') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('bank_account_no',    '382910482910') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('bank_ifsc',          'SBIN0001234') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('bank_branch',        'Vatva Industrial Estate Branch') ON CONFLICT (key) DO NOTHING;

INSERT INTO users (username, password, role, name, status)
VALUES ('admin', 'admin123', 'admin', 'Master Admin', 'active')
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
