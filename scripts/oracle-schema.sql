-- =============================================================================
-- TRIPAL ERP — Oracle Autonomous Database Schema
-- Target: Oracle Autonomous AI Database Always Free (Transaction Processing)
-- =============================================================================
-- Run this script as ADMIN or the designated ERP schema owner.
-- All tables use NUMBER identity columns (Oracle 12c+ GENERATED AS IDENTITY).
-- Money columns: NUMBER(18,2)  |  Quantity columns: NUMBER(18,3)
-- Percent columns: NUMBER(8,4) |  Flags: NUMBER(1) (0/1)
-- =============================================================================

-- ─── SEQUENCES FOR CODE GENERATION ──────────────────────────────────────────
-- These are separate from IDENTITY columns; used for business codes (PUR-000001 etc.)
CREATE SEQUENCE seq_raw_material_code   START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_finished_good_code  START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_customer_code       START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_supplier_code       START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_machine_code        START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_purchase_code       START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_consumption_code    START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_production_code     START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_sale_code           START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_invoice_number      START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_payment_code        START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_adj_code            START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_prod_order_code     START WITH 1 INCREMENT BY 1 NOCACHE;

-- =============================================================================
-- TABLE: users
-- =============================================================================
CREATE TABLE users (
    id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        VARCHAR2(100) NOT NULL,
    password        VARCHAR2(255) NOT NULL,
    role            VARCHAR2(20)  DEFAULT 'admin' NOT NULL,
    name            VARCHAR2(200),
    session_token   VARCHAR2(200),
    manager_id      NUMBER,
    status          VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    created_at      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT ck_users_role CHECK (role IN ('admin', 'manager')),
    CONSTRAINT ck_users_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_users_session_token ON users(session_token);
CREATE INDEX idx_users_role ON users(role);

-- =============================================================================
-- TABLE: managers
-- =============================================================================
CREATE TABLE managers (
    id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR2(200) NOT NULL,
    device_id       VARCHAR2(200),
    phone           VARCHAR2(30),
    status          VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    manager_token   VARCHAR2(200),
    created_at      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_managers_name UNIQUE (name),
    CONSTRAINT uq_managers_token UNIQUE (manager_token),
    CONSTRAINT ck_managers_status CHECK (status IN ('active', 'inactive'))
);

-- =============================================================================
-- TABLE: raw_materials
-- =============================================================================
CREATE TABLE raw_materials (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code             VARCHAR2(50)  NOT NULL,
    name             VARCHAR2(300) NOT NULL,
    category         VARCHAR2(100) NOT NULL,
    unit             VARCHAR2(20)  DEFAULT 'KG' NOT NULL,
    min_stock_alert  NUMBER(18,3)  DEFAULT 1000,
    hsn_code         VARCHAR2(20)  DEFAULT '3901',
    gst_percent      NUMBER(8,4)   DEFAULT 18,
    status           VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_raw_materials_code UNIQUE (code),
    CONSTRAINT uq_raw_materials_name UNIQUE (name),
    CONSTRAINT ck_raw_materials_unit CHECK (unit IN ('KG', 'PCS', 'MTR', 'LTR', 'NOS', 'SET')),
    CONSTRAINT ck_raw_materials_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_raw_materials_status ON raw_materials(status);

-- =============================================================================
-- TABLE: suppliers
-- =============================================================================
CREATE TABLE suppliers (
    id                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_code         VARCHAR2(50),
    name                  VARCHAR2(300) NOT NULL,
    phone                 VARCHAR2(30),
    email                 VARCHAR2(200),
    address               VARCHAR2(500),
    city                  VARCHAR2(100) DEFAULT 'Ahmedabad',
    state                 VARCHAR2(100) DEFAULT 'Gujarat',
    pincode               VARCHAR2(20)  DEFAULT '382445',
    state_code            VARCHAR2(10)  DEFAULT '24',
    gst_number            VARCHAR2(20),
    supplier_type         VARCHAR2(50)  DEFAULT 'GST Registered',
    opening_balance       NUMBER(18,2)  DEFAULT 0,
    opening_balance_type  VARCHAR2(20)  DEFAULT 'Credit',
    status                VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    created_at            TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_suppliers_name UNIQUE (name),
    CONSTRAINT ck_suppliers_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT ck_suppliers_ob_type CHECK (opening_balance_type IN ('Debit', 'Credit'))
);

CREATE INDEX idx_suppliers_status ON suppliers(status);

-- =============================================================================
-- TABLE: customers
-- =============================================================================
CREATE TABLE customers (
    id                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_code         VARCHAR2(50),
    name                  VARCHAR2(300) NOT NULL,
    phone                 VARCHAR2(30),
    email                 VARCHAR2(200),
    address               VARCHAR2(500),
    billing_address       VARCHAR2(500),
    shipping_address      VARCHAR2(500),
    city                  VARCHAR2(100) DEFAULT 'Ahmedabad',
    state                 VARCHAR2(100) DEFAULT 'Gujarat',
    pincode               VARCHAR2(20)  DEFAULT '382445',
    state_code            VARCHAR2(10)  DEFAULT '24',
    gst_number            VARCHAR2(20),
    customer_type         VARCHAR2(50)  DEFAULT 'GST Registered',
    opening_balance       NUMBER(18,2)  DEFAULT 0,
    opening_balance_type  VARCHAR2(20)  DEFAULT 'Debit',
    remarks               VARCHAR2(500),
    status                VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    created_at            TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_customers_name UNIQUE (name),
    CONSTRAINT ck_customers_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT ck_customers_ob_type CHECK (opening_balance_type IN ('Debit', 'Credit'))
);

CREATE INDEX idx_customers_status ON customers(status);

-- =============================================================================
-- TABLE: machines
-- =============================================================================
CREATE TABLE machines (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    machine_code         VARCHAR2(50)  NOT NULL,
    name                 VARCHAR2(200) NOT NULL,
    capacity_kg_per_day  NUMBER(18,3)  DEFAULT 5000,
    status               VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_machines_code UNIQUE (machine_code),
    CONSTRAINT ck_machines_status CHECK (status IN ('active', 'inactive'))
);

-- =============================================================================
-- TABLE: shifts
-- =============================================================================
CREATE TABLE shifts (
    id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR2(100) NOT NULL,
    start_time  VARCHAR2(20),
    end_time    VARCHAR2(20),
    status      VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    created_at  TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_shifts_name UNIQUE (name),
    CONSTRAINT ck_shifts_status CHECK (status IN ('active', 'inactive'))
);

-- =============================================================================
-- TABLE: finished_products
-- =============================================================================
CREATE TABLE finished_products (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_code     VARCHAR2(50)  NOT NULL,
    product_name     VARCHAR2(200) DEFAULT 'Tripal',
    gsm              NUMBER(8,0)   NOT NULL,
    width_size       VARCHAR2(50)  NOT NULL,
    length_val       VARCHAR2(50),
    colour           VARCHAR2(50)  NOT NULL,
    grade            VARCHAR2(50)  DEFAULT 'Grade A',
    unit             VARCHAR2(20)  DEFAULT 'KG',
    min_stock_alert  NUMBER(18,3)  DEFAULT 500,
    hsn_code         VARCHAR2(20)  DEFAULT '3926',
    gst_percent      NUMBER(8,4)   DEFAULT 18,
    status           VARCHAR2(20)  DEFAULT 'active' NOT NULL,
    created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_finished_products_code UNIQUE (product_code),
    CONSTRAINT ck_finished_products_status CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_finished_products_status ON finished_products(status);

-- =============================================================================
-- TABLE: production_orders
-- =============================================================================
CREATE TABLE production_orders (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_no             VARCHAR2(50)  NOT NULL,
    order_date           VARCHAR2(20)  NOT NULL,
    customer_id          NUMBER        NOT NULL,
    customer_order_no    VARCHAR2(100),
    finished_product_id  NUMBER        NOT NULL,
    gsm                  NUMBER(8,0),
    size                 VARCHAR2(50),
    required_quantity    NUMBER(18,3)  NOT NULL,
    unit                 VARCHAR2(20)  DEFAULT 'KG',
    delivery_date        VARCHAR2(20),
    remarks              VARCHAR2(500),
    status               VARCHAR2(30)  DEFAULT 'Pending',
    created_by           VARCHAR2(200) DEFAULT 'Admin',
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_production_orders_no UNIQUE (order_no),
    CONSTRAINT fk_po_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_po_finished_product FOREIGN KEY (finished_product_id) REFERENCES finished_products(id),
    CONSTRAINT ck_po_status CHECK (status IN ('Pending', 'In Production', 'Completed', 'Cancelled'))
);

CREATE INDEX idx_production_orders_customer ON production_orders(customer_id);
CREATE INDEX idx_production_orders_date ON production_orders(order_date);
CREATE INDEX idx_production_orders_status ON production_orders(status);

-- =============================================================================
-- TABLE: consumption_batches  (Material Issue Batches)
-- =============================================================================
CREATE TABLE consumption_batches (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_no             VARCHAR2(50)  NOT NULL,
    date                 VARCHAR2(20)  NOT NULL,
    production_order_id  NUMBER,
    machine_id           NUMBER,
    shift_id             NUMBER,
    manager_id           NUMBER,
    manager_name         VARCHAR2(200) NOT NULL,
    device_id            VARCHAR2(200),
    status               VARCHAR2(20)  DEFAULT 'Issued',
    remarks              VARCHAR2(500),
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_consumption_batches_no UNIQUE (batch_no),
    CONSTRAINT fk_cb_prod_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    CONSTRAINT fk_cb_machine FOREIGN KEY (machine_id) REFERENCES machines(id),
    CONSTRAINT fk_cb_shift FOREIGN KEY (shift_id) REFERENCES shifts(id),
    CONSTRAINT ck_cb_status CHECK (status IN ('Draft', 'Issued', 'Completed', 'Cancelled'))
);

CREATE INDEX idx_cb_date ON consumption_batches(date);
CREATE INDEX idx_cb_machine ON consumption_batches(machine_id);
CREATE INDEX idx_cb_status ON consumption_batches(status);
CREATE INDEX idx_cb_manager ON consumption_batches(manager_name);

-- =============================================================================
-- TABLE: consumption_batch_items
-- =============================================================================
CREATE TABLE consumption_batch_items (
    id                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    consumption_batch_id  NUMBER        NOT NULL,
    raw_material_id       NUMBER        NOT NULL,
    quantity              NUMBER(18,3)  NOT NULL,
    unit                  VARCHAR2(20)  DEFAULT 'KG' NOT NULL,
    batch_lot             VARCHAR2(100),
    remarks               VARCHAR2(500),
    created_at            TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_cbi_batch FOREIGN KEY (consumption_batch_id) REFERENCES consumption_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_cbi_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
    CONSTRAINT ck_cbi_qty CHECK (quantity > 0)
);

CREATE INDEX idx_cbi_batch ON consumption_batch_items(consumption_batch_id);
CREATE INDEX idx_cbi_raw_material ON consumption_batch_items(raw_material_id);

-- =============================================================================
-- TABLE: raw_material_purchases  (Purchase Header)
-- =============================================================================
CREATE TABLE raw_material_purchases (
    id                NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_code     VARCHAR2(50)  NOT NULL,
    date              VARCHAR2(20)  NOT NULL,
    supplier_id       NUMBER        NOT NULL,
    raw_material_id   NUMBER,
    quantity_kg       NUMBER(18,3)  DEFAULT 0,
    rate_per_kg       NUMBER(18,4)  DEFAULT 0,
    taxable_amount    NUMBER(18,2)  DEFAULT 0,
    gst_percent       NUMBER(8,4)   DEFAULT 18,
    cgst_amount       NUMBER(18,2)  DEFAULT 0,
    sgst_amount       NUMBER(18,2)  DEFAULT 0,
    igst_amount       NUMBER(18,2)  DEFAULT 0,
    total_amount      NUMBER(18,2)  DEFAULT 0,
    purchase_type     VARCHAR2(20)  DEFAULT 'GST',
    discount_amount   NUMBER(18,2)  DEFAULT 0,
    other_charges     NUMBER(18,2)  DEFAULT 0,
    round_off         NUMBER(18,2)  DEFAULT 0,
    payment_mode      VARCHAR2(30)  DEFAULT 'Credit',
    invoice_number    VARCHAR2(100),
    remarks           VARCHAR2(500),
    manager_id        NUMBER,
    manager_name      VARCHAR2(200) NOT NULL,
    device_id         VARCHAR2(200),
    is_voided         NUMBER(1)     DEFAULT 0 NOT NULL,
    voided_at         TIMESTAMP,
    voided_by         VARCHAR2(200),
    void_reason       VARCHAR2(500),
    created_at        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_purchases_code UNIQUE (purchase_code),
    CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_purchase_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
    CONSTRAINT ck_purchases_voided CHECK (is_voided IN (0, 1)),
    CONSTRAINT ck_purchases_type CHECK (purchase_type IN ('GST', 'NON_GST'))
);

CREATE INDEX idx_purchases_date ON raw_material_purchases(date);
CREATE INDEX idx_purchases_supplier ON raw_material_purchases(supplier_id);
CREATE INDEX idx_purchases_voided ON raw_material_purchases(is_voided);
CREATE INDEX idx_purchases_manager ON raw_material_purchases(manager_name);

-- =============================================================================
-- TABLE: purchase_items  (Purchase Line Items)
-- =============================================================================
CREATE TABLE purchase_items (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_id      NUMBER        NOT NULL,
    raw_material_id  NUMBER        NOT NULL,
    quantity         NUMBER(18,3)  NOT NULL,
    unit             VARCHAR2(20)  DEFAULT 'KG' NOT NULL,
    rate             NUMBER(18,4)  NOT NULL,
    discount         NUMBER(18,2)  DEFAULT 0,
    hsn_code         VARCHAR2(20),
    gst_percent      NUMBER(8,4)   DEFAULT 0,
    taxable_amount   NUMBER(18,2)  NOT NULL,
    gst_amount       NUMBER(18,2)  DEFAULT 0,
    cgst_amount      NUMBER(18,2)  DEFAULT 0,
    sgst_amount      NUMBER(18,2)  DEFAULT 0,
    igst_amount      NUMBER(18,2)  DEFAULT 0,
    total_amount     NUMBER(18,2)  NOT NULL,
    created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_pi_purchase FOREIGN KEY (purchase_id) REFERENCES raw_material_purchases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
    CONSTRAINT ck_pi_qty CHECK (quantity > 0)
);

CREATE INDEX idx_pi_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_pi_raw_material ON purchase_items(raw_material_id);

-- =============================================================================
-- TABLE: raw_material_movements  (RM Stock Ledger)
-- =============================================================================
CREATE TABLE raw_material_movements (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movement_type    VARCHAR2(50)  NOT NULL,
    reference_type   VARCHAR2(50)  NOT NULL,
    reference_id     VARCHAR2(100) NOT NULL,
    raw_material_id  NUMBER        NOT NULL,
    quantity_change  NUMBER(18,3)  NOT NULL,
    unit             VARCHAR2(20)  DEFAULT 'KG',
    balance_after    NUMBER(18,3)  NOT NULL,
    manager_name     VARCHAR2(200),
    remarks          VARCHAR2(500),
    created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_rmm_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
);

CREATE INDEX idx_rmm_raw_material ON raw_material_movements(raw_material_id);
CREATE INDEX idx_rmm_reference ON raw_material_movements(reference_id);
CREATE INDEX idx_rmm_created_at ON raw_material_movements(created_at);

-- =============================================================================
-- TABLE: production_batches  (Production Header)
-- =============================================================================
CREATE TABLE production_batches (
    id                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_code            VARCHAR2(50)  NOT NULL,
    date                  VARCHAR2(20)  NOT NULL,
    machine_id            NUMBER,
    shift_id              NUMBER,
    raw_material_id       NUMBER,
    raw_material_used_kg  NUMBER(18,3)  DEFAULT 0,
    total_finished_kg     NUMBER(18,3)  DEFAULT 0 NOT NULL,
    total_wastage_kg      NUMBER(18,3)  DEFAULT 0 NOT NULL,
    wastage_unit          VARCHAR2(20)  DEFAULT 'KG',
    wastage_reason        VARCHAR2(200),
    remarks               VARCHAR2(500),
    manager_id            NUMBER,
    manager_name          VARCHAR2(200) DEFAULT 'Admin' NOT NULL,
    device_id             VARCHAR2(200),
    production_order_id   NUMBER,
    consumption_batch_id  NUMBER,
    is_voided             NUMBER(1)     DEFAULT 0 NOT NULL,
    voided_at             TIMESTAMP,
    voided_by             VARCHAR2(200),
    void_reason           VARCHAR2(500),
    created_at            TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at            TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_production_batches_code UNIQUE (batch_code),
    CONSTRAINT fk_pb_machine FOREIGN KEY (machine_id) REFERENCES machines(id),
    CONSTRAINT fk_pb_shift FOREIGN KEY (shift_id) REFERENCES shifts(id),
    CONSTRAINT fk_pb_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
    CONSTRAINT fk_pb_prod_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    CONSTRAINT fk_pb_consumption_batch FOREIGN KEY (consumption_batch_id) REFERENCES consumption_batches(id),
    CONSTRAINT ck_pb_voided CHECK (is_voided IN (0, 1))
);

CREATE INDEX idx_pb_date ON production_batches(date);
CREATE INDEX idx_pb_machine ON production_batches(machine_id);
CREATE INDEX idx_pb_consumption ON production_batches(consumption_batch_id);
CREATE INDEX idx_pb_voided ON production_batches(is_voided);
CREATE INDEX idx_pb_manager ON production_batches(manager_name);

-- =============================================================================
-- TABLE: production_outputs  (Production Line Items)
-- =============================================================================
CREATE TABLE production_outputs (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id             NUMBER        NOT NULL,
    finished_product_id  NUMBER        NOT NULL,
    gsm                  NUMBER(8,0),
    width_size           VARCHAR2(50),
    length_val           VARCHAR2(50),
    colour               VARCHAR2(50),
    grade                VARCHAR2(50),
    quantity_kg          NUMBER(18,3)  NOT NULL,
    unit                 VARCHAR2(20)  DEFAULT 'KG',
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_po_batch FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_finished_product FOREIGN KEY (finished_product_id) REFERENCES finished_products(id),
    CONSTRAINT ck_po_qty CHECK (quantity_kg > 0)
);

CREATE INDEX idx_po_batch ON production_outputs(batch_id);
CREATE INDEX idx_po_finished_product ON production_outputs(finished_product_id);

-- =============================================================================
-- TABLE: finished_goods_movements  (FG Stock Ledger)
-- =============================================================================
CREATE TABLE finished_goods_movements (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movement_type        VARCHAR2(50)  NOT NULL,
    reference_type       VARCHAR2(50)  NOT NULL,
    reference_id         VARCHAR2(100) NOT NULL,
    finished_product_id  NUMBER        NOT NULL,
    quantity_change      NUMBER(18,3)  NOT NULL,
    unit                 VARCHAR2(20)  DEFAULT 'KG',
    balance_after        NUMBER(18,3)  NOT NULL,
    manager_name         VARCHAR2(200),
    remarks              VARCHAR2(500),
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_fgm_finished_product FOREIGN KEY (finished_product_id) REFERENCES finished_products(id)
);

CREATE INDEX idx_fgm_finished_product ON finished_goods_movements(finished_product_id);
CREATE INDEX idx_fgm_reference ON finished_goods_movements(reference_id);
CREATE INDEX idx_fgm_created_at ON finished_goods_movements(created_at);

-- =============================================================================
-- TABLE: sales  (Sales Header)
-- =============================================================================
CREATE TABLE sales (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_code            VARCHAR2(50)  NOT NULL,
    invoice_number       VARCHAR2(100),
    date                 VARCHAR2(20)  NOT NULL,
    customer_id          NUMBER        NOT NULL,
    finished_product_id  NUMBER,
    quantity_kg          NUMBER(18,3)  DEFAULT 0,
    rate_per_kg          NUMBER(18,4)  DEFAULT 0,
    taxable_amount       NUMBER(18,2)  DEFAULT 0,
    gst_percent          NUMBER(8,4)   DEFAULT 18,
    cgst_amount          NUMBER(18,2)  DEFAULT 0,
    sgst_amount          NUMBER(18,2)  DEFAULT 0,
    igst_amount          NUMBER(18,2)  DEFAULT 0,
    total_amount         NUMBER(18,2)  DEFAULT 0,
    sales_type           VARCHAR2(20)  DEFAULT 'GST',
    payment_type         VARCHAR2(30)  DEFAULT 'Cash',
    customer_gstin       VARCHAR2(20),
    billing_address      VARCHAR2(500),
    shipping_address     VARCHAR2(500),
    discount_amount      NUMBER(18,2)  DEFAULT 0,
    other_charges        NUMBER(18,2)  DEFAULT 0,
    round_off            NUMBER(18,2)  DEFAULT 0,
    remarks              VARCHAR2(500),
    manager_id           NUMBER,
    manager_name         VARCHAR2(200) NOT NULL,
    device_id            VARCHAR2(200),
    is_voided            NUMBER(1)     DEFAULT 0 NOT NULL,
    voided_at            TIMESTAMP,
    voided_by            VARCHAR2(200),
    void_reason          VARCHAR2(500),
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_sales_code UNIQUE (sale_code),
    CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_sale_finished_product FOREIGN KEY (finished_product_id) REFERENCES finished_products(id),
    CONSTRAINT ck_sales_voided CHECK (is_voided IN (0, 1)),
    CONSTRAINT ck_sales_type CHECK (sales_type IN ('GST', 'NON_GST'))
);

-- Oracle unique index for invoice_number excluding voided rows
-- Uses a function-based approach: only active invoices must be unique
CREATE UNIQUE INDEX idx_sales_invoice_unique
    ON sales(CASE WHEN is_voided = 0 AND invoice_number IS NOT NULL THEN invoice_number END);

CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_voided ON sales(is_voided);
CREATE INDEX idx_sales_manager ON sales(manager_name);

-- =============================================================================
-- TABLE: sales_items  (Sales Line Items)
-- =============================================================================
CREATE TABLE sales_items (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id              NUMBER        NOT NULL,
    finished_product_id  NUMBER        NOT NULL,
    gsm                  NUMBER(8,0),
    size                 VARCHAR2(50),
    hsn_code             VARCHAR2(20),
    quantity             NUMBER(18,3)  NOT NULL,
    unit                 VARCHAR2(20)  DEFAULT 'KG' NOT NULL,
    rate                 NUMBER(18,4)  NOT NULL,
    discount             NUMBER(18,2)  DEFAULT 0,
    gst_percent          NUMBER(8,4)   DEFAULT 0,
    taxable_amount       NUMBER(18,2)  NOT NULL,
    gst_amount           NUMBER(18,2)  DEFAULT 0,
    cgst_amount          NUMBER(18,2)  DEFAULT 0,
    sgst_amount          NUMBER(18,2)  DEFAULT 0,
    igst_amount          NUMBER(18,2)  DEFAULT 0,
    total_amount         NUMBER(18,2)  NOT NULL,
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_si_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_si_finished_product FOREIGN KEY (finished_product_id) REFERENCES finished_products(id),
    CONSTRAINT ck_si_qty CHECK (quantity > 0)
);

CREATE INDEX idx_si_sale ON sales_items(sale_id);
CREATE INDEX idx_si_finished_product ON sales_items(finished_product_id);

-- =============================================================================
-- TABLE: wastage_records
-- =============================================================================
CREATE TABLE wastage_records (
    id                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date                 VARCHAR2(20)  NOT NULL,
    production_id        NUMBER,
    production_no        VARCHAR2(50)  NOT NULL,
    production_order_id  NUMBER,
    product_id           NUMBER,
    quantity             NUMBER(18,3)  NOT NULL,
    unit                 VARCHAR2(20)  DEFAULT 'KG',
    reason               VARCHAR2(200),
    manager_name         VARCHAR2(200),
    machine_id           NUMBER,
    remarks              VARCHAR2(500),
    created_at           TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_wastage_production ON wastage_records(production_id);
CREATE INDEX idx_wastage_date ON wastage_records(date);

-- =============================================================================
-- TABLE: payments  (Customer Receipts + Supplier Payments)
-- =============================================================================
CREATE TABLE payments (
    id             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_code   VARCHAR2(50)  NOT NULL,
    date           VARCHAR2(20)  NOT NULL,
    party_type     VARCHAR2(20)  NOT NULL,
    party_id       NUMBER        NOT NULL,
    amount         NUMBER(18,2)  NOT NULL,
    payment_mode   VARCHAR2(30)  DEFAULT 'Bank',
    reference_no   VARCHAR2(200),
    remarks        VARCHAR2(500),
    against_type   VARCHAR2(30)  DEFAULT 'ON_ACCOUNT',
    invoice_id     NUMBER,
    created_by     VARCHAR2(200) DEFAULT 'Admin',
    manager_id     NUMBER,
    manager_name   VARCHAR2(200),
    device_id      VARCHAR2(200),
    is_voided      NUMBER(1)     DEFAULT 0 NOT NULL,
    voided_at      TIMESTAMP,
    voided_by      VARCHAR2(200),
    void_reason    VARCHAR2(500),
    created_at     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_payments_code UNIQUE (payment_code),
    CONSTRAINT ck_payments_party_type CHECK (party_type IN ('CUSTOMER', 'SUPPLIER')),
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT ck_payments_voided CHECK (is_voided IN (0, 1))
);

CREATE INDEX idx_payments_party ON payments(party_type, party_id);
CREATE INDEX idx_payments_date ON payments(date);
CREATE INDEX idx_payments_voided ON payments(is_voided);

-- =============================================================================
-- TABLE: stock_adjustments  (Inventory Reconciliation)
-- =============================================================================
CREATE TABLE stock_adjustments (
    id                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    adjustment_code       VARCHAR2(50)  NOT NULL,
    date                  VARCHAR2(20)  NOT NULL,
    item_type             VARCHAR2(30)  NOT NULL,
    item_id               NUMBER        NOT NULL,
    system_quantity_kg    NUMBER(18,3)  NOT NULL,
    physical_quantity_kg  NUMBER(18,3)  NOT NULL,
    difference_kg         NUMBER(18,3)  NOT NULL,
    status                VARCHAR2(20)  NOT NULL,
    reason                VARCHAR2(500),
    adjusted_by           VARCHAR2(200) NOT NULL,
    device_id             VARCHAR2(200),
    created_at            TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_stock_adj_code UNIQUE (adjustment_code),
    CONSTRAINT ck_adj_item_type CHECK (item_type IN ('RAW_MATERIAL', 'FINISHED_GOOD')),
    CONSTRAINT ck_adj_status CHECK (status IN ('MATCHED', 'SHORT', 'EXCESS'))
);

CREATE INDEX idx_adj_date ON stock_adjustments(date);
CREATE INDEX idx_adj_item ON stock_adjustments(item_type, item_id);

-- =============================================================================
-- TABLE: audit_logs
-- =============================================================================
CREATE TABLE audit_logs (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity_type      VARCHAR2(50)  NOT NULL,
    entity_id        VARCHAR2(100) NOT NULL,
    action           VARCHAR2(50)  NOT NULL,
    original_values  CLOB,
    new_values       CLOB,
    performed_by     VARCHAR2(200),
    device_id        VARCHAR2(200),
    timestamp        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- =============================================================================
-- TABLE: settings  (Company & Application Settings — Key-Value)
-- =============================================================================
CREATE TABLE settings (
    key         VARCHAR2(100) NOT NULL,
    value       CLOB,
    updated_at  TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_settings PRIMARY KEY (key)
);

-- =============================================================================
-- DEFAULT DATA: Company Settings
-- =============================================================================
INSERT INTO settings (key, value) VALUES ('company_name',       'TRIPAL MANUFACTURING PVT. LTD.');
INSERT INTO settings (key, value) VALUES ('company_address',    'GIDC Industrial Estate, Phase 2, Vatva, Ahmedabad, Gujarat - 382445');
INSERT INTO settings (key, value) VALUES ('company_gstin',      '24AAACT1234F1Z5');
INSERT INTO settings (key, value) VALUES ('company_state',      'Gujarat');
INSERT INTO settings (key, value) VALUES ('company_state_code', '24');
INSERT INTO settings (key, value) VALUES ('company_city',       'Ahmedabad');
INSERT INTO settings (key, value) VALUES ('company_pincode',    '382445');
INSERT INTO settings (key, value) VALUES ('company_phone',      '+91 79 2583 0000');
INSERT INTO settings (key, value) VALUES ('company_email',      'accounts@tripalmanufacturing.com');
INSERT INTO settings (key, value) VALUES ('bank_name',          'State Bank of India');
INSERT INTO settings (key, value) VALUES ('bank_account_no',    '382910482910');
INSERT INTO settings (key, value) VALUES ('bank_ifsc',          'SBIN0001234');
INSERT INTO settings (key, value) VALUES ('bank_branch',        'Vatva Industrial Estate Branch');

-- =============================================================================
-- DEFAULT DATA: Admin User
-- =============================================================================
INSERT INTO users (username, password, role, name, status)
VALUES ('admin', 'admin123', 'admin', 'Master Admin', 'active');

COMMIT;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
